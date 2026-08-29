import { describe, expect, it, vi } from 'vitest';
import { createTheRundownEventsService } from './events-service';
import type { TheRundownClient } from './client';
import type { TheRundownEvent } from './types';

function buildEvent(overrides: Partial<TheRundownEvent> = {}): TheRundownEvent {
  return {
    event_id: 'e1',
    sport_id: 11,
    event_date: '2026-08-28T19:00:00Z',
    teams: [
      { team_id: 1, name: 'Crystal Palace', mascot: '', abbreviation: 'CRY', is_home: true, is_away: false },
      { team_id: 2, name: 'Manchester City', mascot: '', abbreviation: 'MNC', is_home: false, is_away: true },
    ],
    markets: [
      {
        market_id: 1,
        name: 'moneyline',
        participants: [
          {
            id: 1,
            type: 'TYPE_TEAM',
            name: 'Crystal Palace',
            lines: [{ value: '', prices: { '19': { price: 150, is_main_line: true, updated_at: '2026-08-28T00:00:00Z' } } }],
          },
          {
            id: 2,
            type: 'TYPE_TEAM',
            name: 'Manchester City',
            lines: [{ value: '', prices: { '19': { price: -180, is_main_line: true, updated_at: '2026-08-28T00:00:00Z' } } }],
          },
          {
            id: 3,
            type: 'TYPE_RESULT',
            name: 'Draw',
            lines: [{ value: '', prices: { '19': { price: 240, is_main_line: true, updated_at: '2026-08-28T00:00:00Z' } } }],
          },
        ],
      },
    ],
    ...overrides,
  };
}

function buildClient(overrides: Partial<TheRundownClient> = {}): TheRundownClient {
  return {
    getSports: vi.fn().mockResolvedValue([]),
    getEventsBySportAndDate: vi.fn().mockResolvedValue([]),
    getEventById: vi.fn(),
    getTeamStats: vi.fn().mockResolvedValue([]),
    getPlayerStats: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

const EPL = { id: 11, sport: 'Football', country: 'England', competition: 'Premier League' };
const LA_LIGA = { id: 14, sport: 'Football', country: 'Spain', competition: 'La Liga' };

// Every test injects a no-op sleep so a run doesn't take real seconds - the
// production default (~1.1s between requests) is exercised separately below.
const noSleep = async () => undefined;

describe('createTheRundownEventsService', () => {
  it('fetches today and tomorrow for every configured sport and merges the results', async () => {
    const getEventsBySportAndDate = vi
      .fn()
      .mockImplementation(({ sportId, date }: { sportId: number; date: string }) =>
        Promise.resolve([buildEvent({ event_id: `${sportId}-${date}`, sport_id: sportId })]),
      );
    const client = buildClient({ getEventsBySportAndDate });
    const currentTime = new Date('2026-08-28T12:00:00Z').getTime();
    const service = createTheRundownEventsService({
      client,
      sportIds: [EPL, LA_LIGA],
      now: () => currentTime,
      sleep: noSleep,
    });

    const matches = await service.listMatches();

    // 2 sports x 2 dates (today + tomorrow)
    expect(getEventsBySportAndDate).toHaveBeenCalledTimes(4);
    expect(matches).toHaveLength(4);
    expect(matches.every((match) => match.id.startsWith('therundown:'))).toBe(true);
  });

  it('spaces requests out with sleep() instead of firing them all at once', async () => {
    const getEventsBySportAndDate = vi.fn().mockResolvedValue([buildEvent()]);
    const client = buildClient({ getEventsBySportAndDate });
    const sleep = vi.fn().mockResolvedValue(undefined);
    const service = createTheRundownEventsService({ client, sportIds: [EPL, LA_LIGA], requestIntervalMs: 1100, sleep });

    await service.listMatches();

    // 4 requests (2 sports x 2 dates) -> 3 gaps between them, none before the first.
    expect(sleep).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledWith(1100);
    // The requests themselves happen sequentially, not concurrently.
    expect(getEventsBySportAndDate.mock.invocationCallOrder[0]).toBeLessThan(sleep.mock.invocationCallOrder[0]!);
  });

  it('de-dupes the same event id returned for both today and tomorrow', async () => {
    const getEventsBySportAndDate = vi.fn().mockResolvedValue([buildEvent({ event_id: 'shared' })]);
    const client = buildClient({ getEventsBySportAndDate });
    const service = createTheRundownEventsService({ client, sportIds: [EPL], sleep: noSleep });

    const matches = await service.listMatches();

    expect(matches).toHaveLength(1);
  });

  it('keeps matches from the sport that succeeds when another fails', async () => {
    const getEventsBySportAndDate = vi.fn().mockImplementation(({ sportId }: { sportId: number }) => {
      if (sportId === LA_LIGA.id) return Promise.reject(new Error('therundown GET ... failed: 500'));
      return Promise.resolve([buildEvent({ event_id: 'e1', sport_id: sportId })]);
    });
    const client = buildClient({ getEventsBySportAndDate });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const service = createTheRundownEventsService({ client, sportIds: [EPL, LA_LIGA], sleep: noSleep });

    const matches = await service.listMatches();

    expect(matches).toHaveLength(1);
    errorSpy.mockRestore();
  });

  it('caches the merged list and only refetches after the TTL', async () => {
    const getEventsBySportAndDate = vi.fn().mockResolvedValue([buildEvent()]);
    const client = buildClient({ getEventsBySportAndDate });
    let currentTime = 0;
    const service = createTheRundownEventsService({ client, sportIds: [EPL], now: () => currentTime, sleep: noSleep });

    await service.listMatches();
    await service.listMatches();
    expect(getEventsBySportAndDate).toHaveBeenCalledTimes(2); // today + tomorrow, once

    currentTime = 5 * 60_000 + 1;
    await service.listMatches();
    expect(getEventsBySportAndDate).toHaveBeenCalledTimes(4);
  });

  it('does not cache an empty result when every request fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const getEventsBySportAndDate = vi.fn().mockRejectedValue(new Error('therundown GET ... failed: 401'));
    const client = buildClient({ getEventsBySportAndDate });
    const service = createTheRundownEventsService({ client, sportIds: [EPL], sleep: noSleep });

    const first = await service.listMatches();
    const second = await service.listMatches();

    expect(first).toEqual([]);
    expect(second).toEqual([]);
    expect(getEventsBySportAndDate).toHaveBeenCalledTimes(4); // retried both times, no caching
    errorSpy.mockRestore();
  });

  it('keeps going after one request fails partway through the sequence', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const getEventsBySportAndDate = vi
      .fn()
      .mockImplementationOnce(() => Promise.reject(new Error('therundown GET ... failed: 429')))
      .mockImplementation(({ sportId, date }: { sportId: number; date: string }) =>
        Promise.resolve([buildEvent({ event_id: `${sportId}-${date}`, sport_id: sportId })]),
      );
    const client = buildClient({ getEventsBySportAndDate });
    const service = createTheRundownEventsService({ client, sportIds: [EPL, LA_LIGA], sleep: noSleep });

    const matches = await service.listMatches();

    expect(getEventsBySportAndDate).toHaveBeenCalledTimes(4); // the failure doesn't stop the rest of the sequence
    expect(matches).toHaveLength(3); // 4 requests - 1 failed
    errorSpy.mockRestore();
  });

  it('looks up a single match from the cached list without an extra request', async () => {
    const getEventsBySportAndDate = vi.fn().mockResolvedValue([buildEvent({ event_id: 'e1' })]);
    const client = buildClient({ getEventsBySportAndDate });
    const service = createTheRundownEventsService({ client, sportIds: [EPL], sleep: noSleep });

    await service.listMatches();
    const match = await service.getMatchOdds('therundown:e1');

    expect(getEventsBySportAndDate).toHaveBeenCalledTimes(2); // today + tomorrow only
    expect(match?.id).toBe('therundown:e1');
  });

  it('returns undefined for an id that was never in the list', async () => {
    const client = buildClient();
    const service = createTheRundownEventsService({ client, sportIds: [EPL], sleep: noSleep });

    const match = await service.getMatchOdds('therundown:unknown');
    expect(match).toBeUndefined();
  });
});
