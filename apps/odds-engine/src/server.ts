import { createServer, type Server } from 'node:http';
import { WebSocketServer } from 'ws';
import { createOddsApiIoClient } from './providers/odds-api-io/client';
import { createEventsService, type EventsService } from './providers/odds-api-io/events-service';

export interface OddsEngineOptions {
  /** How often to push a stub odds tick to connected clients. */
  tickIntervalMs?: number;
  /** When provided, serves GET /events and GET /events/:id from this service. */
  eventsService?: EventsService;
}

export interface OddsEngine {
  httpServer: Server;
  listen(port: number): Promise<void>;
  close(): Promise<void>;
}

/**
 * Standalone real-time odds/trading service stub (see docs/PROJECT_BRIEF.md,
 * Section 4). Currently just proves the shape: HTTP health check + a
 * WebSocket stream pushing stub ticks. Real market data, and wiring this
 * onto the cross-process event bus, land in Phase 3.
 */
export function createOddsEngine(options: OddsEngineOptions = {}): OddsEngine {
  const tickIntervalMs = options.tickIntervalMs ?? 5000;

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

    const { eventsService } = options;
    const { pathname } = new URL(req.url, 'http://internal');

    if (eventsService && pathname === '/events') {
      eventsService
        .listMatches()
        .then((matches) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(matches));
        })
        .catch(() => {
          res.writeHead(502);
          res.end();
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
        .catch(() => {
          res.writeHead(502);
          res.end();
        });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  const wss = new WebSocketServer({ server: httpServer, path: '/odds' });

  wss.on('connection', (socket) => {
    const interval = setInterval(() => {
      socket.send(JSON.stringify({ type: 'odds.stub_tick', occurredAt: new Date().toISOString() }));
    }, tickIntervalMs);

    socket.on('close', () => clearInterval(interval));
  });

  return {
    httpServer,
    listen: (port: number) =>
      new Promise<void>((resolve) => {
        httpServer.listen(port, resolve);
      }),
    close: () =>
      new Promise<void>((resolve, reject) => {
        wss.close();
        httpServer.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

if (require.main === module) {
  const port = process.env.PORT ? Number(process.env.PORT) : 4001;
  const apiKey = process.env.ODDS_API_IO_KEY;

  let eventsService: EventsService | undefined;
  if (apiKey) {
    eventsService = createEventsService({ client: createOddsApiIoClient({ apiKey }) });
  } else {
    console.warn('ODDS_API_IO_KEY not set - /events endpoints will 404.');
  }

  void createOddsEngine({ eventsService }).listen(port);
}
