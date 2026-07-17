import { describe, expect, it, vi } from 'vitest';
import { createEventsService } from './events-service';
import type { OddsApiIoClient } from './client';
import type { OddsApiIoEvent, OddsApiIoOddsResponse } from './types';

function buildEvent(overrides: Partial<OddsApiIoEvent> = {}): OddsApiIoEvent {
  return {
    id: 1,
    home: 'Spain',
    away: 'Argentina',
    homeId: 4698,
    awayId: 4819,
    date: '2026-07-19T19:00:00Z',
    status: 'pending',
    sport: { name: 'Football', slug: 'football' },
    league: { name: 'International - FIFA World Cup', slug: 'international-fifa-world-cup' },
    ...overrides,
  };
}

function buildOddsResponse(overrides: Partial<OddsApiIoOddsResponse> = {}): OddsApiIoOddsResponse {
  return {
    id: 1,
    home: 'Spain',
    away: 'Argentina',
    homeId: 4698,
    awayId: 4819,
    date: '2026-07-19T19:00:00Z',
    status: 'pending',
    sport: { name: 'Football', slug: 'football' },
    league: { name: 'International - FIFA World Cup', slug: 'international-fifa-world-cup' },
    urls: {},
    bookmakerIds: {},
    bookmakers: {
      'Betclic PT': [
        {
          name: 'ML',
          updatedAt: '2026-07-16T04:53:40.805Z',
          odds: [{ home: '2.27', draw: '3.08', away: '3.53' }],
        },
      ],
    },
    ...overrides,
  };
}

describe('createEventsService', () => {
  it('lists pending and live events without markets', async () => {
    const getEvents = vi
      .fn()
      .mockResolvedValue([
        buildEvent({ id: 1, status: 'pending' }),
        buildEvent({ id: 2, status: 'live', date: '2026-07-18T10:00:00Z' }),
        buildEvent({ id: 3, status: 'settled' }),
        buildEvent({ id: 4, status: 'cancelled' }),
      ]);
    const client: OddsApiIoClient = { getEvents, getOdds: vi.fn() };
    const service = createEventsService({ client });

    const matches = await service.listMatches();

    expect(matches).toHaveLength(2);
    expect(matches.every((match) => match.markets.length === 0)).toBe(true);
    // Sorted soonest kickoff first.
    expect(matches.map((match) => match.id)).toEqual(['2', '1']);
    expect(matches[1]?.isLive).toBe(false);
    expect(matches[0]?.isLive).toBe(true);
  });

  it('caches the events list and only calls the client once within the TTL', async () => {
    const getEvents = vi.fn().mockResolvedValue([buildEvent()]);
    const client: OddsApiIoClient = { getEvents, getOdds: vi.fn() };
    let currentTime = 0;
    const service = createEventsService({ client, now: () => currentTime });

    await service.listMatches();
    await service.listMatches();
    expect(getEvents).toHaveBeenCalledTimes(1);

    currentTime = 61_000;
    await service.listMatches();
    expect(getEvents).toHaveBeenCalledTimes(2);
  });

  it('fetches and normalizes odds for a single event on demand', async () => {
    const getOdds = vi.fn().mockResolvedValue(buildOddsResponse());
    const client: OddsApiIoClient = { getEvents: vi.fn(), getOdds };
    const service = createEventsService({ client });

    const match = await service.getMatchOdds('1');

    expect(getOdds).toHaveBeenCalledWith(1);
    expect(match?.markets).toEqual([
      {
        id: 'match-result',
        name: 'Match Result',
        selections: [
          { id: 'home', name: 'Home', odds: 2.27 },
          { id: 'draw', name: 'Draw', odds: 3.08 },
          { id: 'away', name: 'Away', odds: 3.53 },
        ],
      },
    ]);
  });

  it('caches per-event odds and only calls the client once within the TTL', async () => {
    const getOdds = vi.fn().mockResolvedValue(buildOddsResponse());
    const client: OddsApiIoClient = { getEvents: vi.fn(), getOdds };
    let currentTime = 0;
    const service = createEventsService({ client, now: () => currentTime });

    await service.getMatchOdds('1');
    await service.getMatchOdds('1');
    expect(getOdds).toHaveBeenCalledTimes(1);

    currentTime = 21_000;
    await service.getMatchOdds('1');
    expect(getOdds).toHaveBeenCalledTimes(2);
  });
});
