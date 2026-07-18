import { createServer, type Server } from 'node:http';
import { config } from 'dotenv';
import WebSocket, { WebSocketServer } from 'ws';
import type { LiveMatchState } from '@sportsbook/shared';
import { createApiSportsClient } from './providers/api-sports/client';
import {
  createLiveTrackerService,
  type LiveTrackerService,
} from './providers/api-sports/live-tracker-service';
import { createOddsApiIoClient } from './providers/odds-api-io/client';
import { createEventsService, type EventsService } from './providers/odds-api-io/events-service';

export interface OddsEngineOptions {
  /** How often to push a stub odds tick to connected clients. */
  tickIntervalMs?: number;
  /** When provided, serves GET /events and GET /events/:id from this service. */
  eventsService?: EventsService;
  /**
   * Given the engine's own broadcast function, returns a live tracker
   * service to power GET /events/:id/live and the `live.match_update` WS
   * push. A factory (rather than a pre-built instance) because the tracker
   * needs the engine's WS client set to broadcast to, which only exists
   * once the engine itself is under construction.
   */
  createLiveTrackerService?: (onUpdate: (state: LiveMatchState) => void) => LiveTrackerService;
}

export interface OddsEngine {
  httpServer: Server;
  listen(port: number): Promise<void>;
  close(): Promise<void>;
}

/**
 * Standalone real-time odds/trading service (see docs/PROJECT_BRIEF.md,
 * Section 4). HTTP: GET /events, GET /events/:id (odds-api.io), and
 * GET /events/:id/live (api-sports, for currently-live matches only).
 * WebSocket /odds: stub odds ticks (Phase 3 placeholder) plus real
 * `live.match_update` pushes whenever the live tracker polls.
 */
export function createOddsEngine(options: OddsEngineOptions = {}): OddsEngine {
  const tickIntervalMs = options.tickIntervalMs ?? 5000;
  const { eventsService } = options;

  const wsClients = new Set<WebSocket>();

  function broadcastLiveUpdate(state: LiveMatchState) {
    const payload = JSON.stringify({ type: 'live.match_update', matchId: state.matchId, state });
    for (const client of wsClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  const liveTrackerService = options.createLiveTrackerService?.(broadcastLiveUpdate);

  const httpServer = createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method !== 'GET' || !req.url) {
      res.writeHead(404);
      res.end();
      return;
    }

    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    const { pathname } = new URL(req.url, 'http://internal');

    if (eventsService && pathname === '/events') {
      eventsService
        .listMatches()
        .then((matches) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(matches));
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          console.error('GET /events failed:', message);
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: message }));
        });
      return;
    }

    const liveMatch =
      eventsService && liveTrackerService ? /^\/events\/([^/]+)\/live$/.exec(pathname) : null;
    if (eventsService && liveTrackerService && liveMatch) {
      const matchId = liveMatch[1] as string;
      eventsService
        .listMatches()
        .then(async (matches) => {
          const match = matches.find((candidate) => candidate.id === matchId);
          if (!match || !match.isLive) {
            res.writeHead(404);
            res.end();
            return;
          }

          await liveTrackerService.track({
            id: match.id,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
          });
          const state = liveTrackerService.getState(match.id);
          if (!state) {
            res.writeHead(404);
            res.end();
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(state));
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`GET /events/${matchId}/live failed:`, message);
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: message }));
        });
      return;
    }

    const eventIdMatch = eventsService ? /^\/events\/([^/]+)$/.exec(pathname) : null;
    if (eventsService && eventIdMatch) {
      eventsService
        .getMatchOdds(eventIdMatch[1] as string)
        .then((match) => {
          if (!match) {
            res.writeHead(404);
            res.end();
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(match));
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`GET /events/${eventIdMatch[1]} failed:`, message);
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: message }));
        });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  const wss = new WebSocketServer({ server: httpServer, path: '/odds' });

  wss.on('connection', (socket) => {
    wsClients.add(socket);

    const interval = setInterval(() => {
      socket.send(JSON.stringify({ type: 'odds.stub_tick', occurredAt: new Date().toISOString() }));
    }, tickIntervalMs);

    socket.on('close', () => {
      clearInterval(interval);
      wsClients.delete(socket);
    });
  });

  return {
    httpServer,
    listen: (port: number) =>
      new Promise<void>((resolve) => {
        httpServer.listen(port, resolve);
      }),
    close: () =>
      new Promise<void>((resolve, reject) => {
        liveTrackerService?.stop();
        wss.close();
        httpServer.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

if (require.main === module) {
  config();

  const port = process.env.PORT ? Number(process.env.PORT) : 4001;
  const apiKey = process.env.ODDS_API_IO_KEY;
  const apiSportsKey = process.env.API_SPORTS_KEY;

  let eventsService: EventsService | undefined;
  if (apiKey) {
    eventsService = createEventsService({ client: createOddsApiIoClient({ apiKey }) });
  } else {
    console.warn('ODDS_API_IO_KEY not set - /events endpoints will 404.');
  }

  let createLiveTrackerServiceOption: OddsEngineOptions['createLiveTrackerService'];
  if (apiSportsKey) {
    const apiSportsClient = createApiSportsClient({ apiKey: apiSportsKey });
    createLiveTrackerServiceOption = (onUpdate) =>
      createLiveTrackerService({ client: apiSportsClient, onUpdate });
  } else {
    console.warn('API_SPORTS_KEY not set - GET /events/:id/live will 404.');
  }

  void createOddsEngine({
    eventsService,
    createLiveTrackerService: createLiveTrackerServiceOption,
  }).listen(port);
}
