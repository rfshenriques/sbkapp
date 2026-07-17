import type { AddressInfo } from 'node:net';
import WebSocket from 'ws';
import { afterEach, describe, expect, it } from 'vitest';
import type { Match } from './domain/odds';
import type { EventsService } from './providers/odds-api-io/events-service';
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
});
