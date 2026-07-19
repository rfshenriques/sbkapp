import type { AddressInfo } from 'node:net';
import WebSocket from 'ws';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LiveMatchState, Match } from '@sportsbook/shared';
import type { LiveTrackerService } from './providers/api-sports/live-tracker-service';
import type { EventsService } from './providers/the-odds-api/events-service';
import { createOddsEngine, type OddsEngine } from './server';

const stubMatch: Match = {
  id: '1',
  competition: 'International - FIFA World Cup',
  homeTeam: 'Spain',
  awayTeam: 'Argentina',
  kickoff: '2026-07-19T19:00:00Z',
  isLive: false,
  markets: [],
};

const stubLiveState: LiveMatchState = {
  matchId: '1',
  minute: 23,
  homeScore: 1,
  awayScore: 0,
  events: [],
  stats: [],
  momentum: { home: 50, away: 50 },
  updatedAt: '2026-07-18T18:00:00.000Z',
};

describe('odds engine stub', () => {
  let engine: OddsEngine | undefined;

  afterEach(async () => {
    await engine?.close();
    engine = undefined;
  });

  it('responds to a health check', async () => {
    engine = createOddsEngine();
    await engine.listen(0);
    const port = (engine.httpServer.address() as AddressInfo).port;

    const response = await fetch(`http://127.0.0.1:${port}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('streams stub odds ticks over the websocket connection', async () => {
    engine = createOddsEngine({ tickIntervalMs: 10 });
    await engine.listen(0);
    const port = (engine.httpServer.address() as AddressInfo).port;

    const message = await new Promise<string>((resolve, reject) => {
      const socket = new WebSocket(`ws://127.0.0.1:${port}/odds`);
      socket.once('message', (data) => {
        resolve(data.toString());
        socket.close();
      });
      socket.once('error', reject);
    });

    expect(JSON.parse(message)).toMatchObject({ type: 'odds.stub_tick' });
  });

  it('404s on /events when no events service is configured', async () => {
    engine = createOddsEngine();
    await engine.listen(0);
    const port = (engine.httpServer.address() as AddressInfo).port;

    const response = await fetch(`http://127.0.0.1:${port}/events`);
    expect(response.status).toBe(404);
  });

  it('serves the match list from the events service on GET /events', async () => {
    const eventsService: EventsService = {
      listMatches: async () => [stubMatch],
      getMatchOdds: async () => undefined,
    };
    engine = createOddsEngine({ eventsService });
    await engine.listen(0);
    const port = (engine.httpServer.address() as AddressInfo).port;

    const response = await fetch(`http://127.0.0.1:${port}/events`);

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(await response.json()).toEqual([stubMatch]);
  });

  it('serves a single match with odds on GET /events/:id', async () => {
    const matchWithOdds: Match = {
      ...stubMatch,
      markets: [
        {
          id: 'match-result',
          name: 'Match Result',
          selections: [{ id: 'home', name: 'Home', odds: 2.27 }],
        },
      ],
    };
    const eventsService: EventsService = {
      listMatches: async () => [],
      getMatchOdds: async (eventId) => (eventId === '1' ? matchWithOdds : undefined),
    };
    engine = createOddsEngine({ eventsService });
    await engine.listen(0);
    const port = (engine.httpServer.address() as AddressInfo).port;

    const response = await fetch(`http://127.0.0.1:${port}/events/1`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(matchWithOdds);
  });

  it('returns the underlying error message when the events service fails', async () => {
    const eventsService: EventsService = {
      listMatches: async () => {
        throw new Error('odds-api.io GET /events failed: 429 Too Many Requests');
      },
      getMatchOdds: async () => undefined,
    };
    engine = createOddsEngine({ eventsService });
    await engine.listen(0);
    const port = (engine.httpServer.address() as AddressInfo).port;

    const response = await fetch(`http://127.0.0.1:${port}/events`);

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: 'odds-api.io GET /events failed: 429 Too Many Requests',
    });
  });

  it('404s on GET /events/:id when the event is unknown', async () => {
    const eventsService: EventsService = {
      listMatches: async () => [],
      getMatchOdds: async () => undefined,
    };
    engine = createOddsEngine({ eventsService });
    await engine.listen(0);
    const port = (engine.httpServer.address() as AddressInfo).port;

    const response = await fetch(`http://127.0.0.1:${port}/events/does-not-exist`);
    expect(response.status).toBe(404);
  });

  function buildFakeLiveTrackerService(
    overrides: Partial<LiveTrackerService> = {},
  ): LiveTrackerService {
    return {
      track: vi.fn().mockResolvedValue(undefined),
      getState: vi.fn().mockReturnValue(undefined),
      stop: vi.fn(),
      ...overrides,
    };
  }

  it('404s on GET /events/:id/live when no live tracker service is configured', async () => {
    const eventsService: EventsService = {
      listMatches: async () => [{ ...stubMatch, isLive: true }],
      getMatchOdds: async () => undefined,
    };
    engine = createOddsEngine({ eventsService });
    await engine.listen(0);
    const port = (engine.httpServer.address() as AddressInfo).port;

    const response = await fetch(`http://127.0.0.1:${port}/events/1/live`);
    expect(response.status).toBe(404);
  });

  it('404s on GET /events/:id/live when the match is not live', async () => {
    const eventsService: EventsService = {
      listMatches: async () => [stubMatch], // isLive: false
      getMatchOdds: async () => undefined,
    };
    const liveTracker = buildFakeLiveTrackerService();
    engine = createOddsEngine({
      eventsService,
      createLiveTrackerService: () => liveTracker,
    });
    await engine.listen(0);
    const port = (engine.httpServer.address() as AddressInfo).port;

    const response = await fetch(`http://127.0.0.1:${port}/events/1/live`);

    expect(response.status).toBe(404);
    expect(liveTracker.track).not.toHaveBeenCalled();
  });

  it('404s on GET /events/:id/live when the match does not exist', async () => {
    const eventsService: EventsService = {
      listMatches: async () => [],
      getMatchOdds: async () => undefined,
    };
    engine = createOddsEngine({
      eventsService,
      createLiveTrackerService: () => buildFakeLiveTrackerService(),
    });
    await engine.listen(0);
    const port = (engine.httpServer.address() as AddressInfo).port;

    const response = await fetch(`http://127.0.0.1:${port}/events/does-not-exist/live`);
    expect(response.status).toBe(404);
  });

  it('tracks and serves the live match state on GET /events/:id/live', async () => {
    const eventsService: EventsService = {
      listMatches: async () => [{ ...stubMatch, isLive: true }],
      getMatchOdds: async () => undefined,
    };
    const liveTracker = buildFakeLiveTrackerService({
      getState: vi.fn().mockReturnValue(stubLiveState),
    });
    engine = createOddsEngine({
      eventsService,
      createLiveTrackerService: () => liveTracker,
    });
    await engine.listen(0);
    const port = (engine.httpServer.address() as AddressInfo).port;

    const response = await fetch(`http://127.0.0.1:${port}/events/1/live`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(stubLiveState);
    expect(liveTracker.track).toHaveBeenCalledWith({
      id: '1',
      homeTeam: 'Spain',
      awayTeam: 'Argentina',
    });
  });

  it('404s on GET /events/:id/live when the tracker has no state for it yet (no matching fixture)', async () => {
    const eventsService: EventsService = {
      listMatches: async () => [{ ...stubMatch, isLive: true }],
      getMatchOdds: async () => undefined,
    };
    engine = createOddsEngine({
      eventsService,
      createLiveTrackerService: () => buildFakeLiveTrackerService(),
    });
    await engine.listen(0);
    const port = (engine.httpServer.address() as AddressInfo).port;

    const response = await fetch(`http://127.0.0.1:${port}/events/1/live`);
    expect(response.status).toBe(404);
  });

  it('broadcasts live.match_update over the websocket when the tracker pushes an update', async () => {
    let capturedOnUpdate: ((state: LiveMatchState) => void) | undefined;
    engine = createOddsEngine({
      tickIntervalMs: 60_000, // avoid a stub tick racing the manual broadcast below
      createLiveTrackerService: (onUpdate) => {
        capturedOnUpdate = onUpdate;
        return buildFakeLiveTrackerService();
      },
    });
    await engine.listen(0);
    const port = (engine.httpServer.address() as AddressInfo).port;

    const socket = new WebSocket(`ws://127.0.0.1:${port}/odds`);
    await new Promise<void>((resolve, reject) => {
      socket.once('open', () => resolve());
      socket.once('error', reject);
    });

    const messagePromise = new Promise<string>((resolve, reject) => {
      socket.once('message', (data) => resolve(data.toString()));
      socket.once('error', reject);
    });

    expect(capturedOnUpdate).toBeDefined();
    capturedOnUpdate?.(stubLiveState);

    const message = await messagePromise;
    expect(JSON.parse(message)).toEqual({
      type: 'live.match_update',
      matchId: '1',
      state: stubLiveState,
    });
    socket.close();
  });
});
