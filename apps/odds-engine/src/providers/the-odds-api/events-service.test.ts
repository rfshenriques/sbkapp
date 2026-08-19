import { describe, expect, it, vi } from 'vitest';
import { createEventsService, verifySportKeys } from './events-service';
import type { TheOddsApiClient } from './client';
import type { TheOddsApiEventOdds, TheOddsApiSport } from './types';

function buildEventOdds(overrides: Partial<TheOddsApiEventOdds> = {}): TheOddsApiEventOdds {
  return {
    id: 'e1',
    sport_key: 'soccer_epl',
    sport_title: 'EPL',
    commence_time: '2026-07-19T19:00:00Z',
    home_team: 'Arsenal',
    away_team: 'Chelsea',
    bookmakers: [
      {
        key: 'paddypower',
        title: 'Paddy Power',
        last_update: '2026-07-19T18:00:00Z',
        markets: [
          {
            key: 'h2h',
            last_update: '2026-07-19T18:00:00Z',
            outcomes: [
              { name: 'Arsenal', price: 1.95 },
              { name: 'Draw', price: 3.6 },
              { name: 'Chelsea', price: 4.0 },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

function buildClient(overrides: Partial<TheOddsApiClient> = {}): TheOddsApiClient {
  return {
    getSports: vi.fn(),
    getOdds: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('createEventsService', () => {
  it('merges events (with odds already embedded) from every configured sport key', async () => {
    const getOdds = vi
      .fn()
      .mockImplementation(({ sportKey }: { sportKey: string }) =>
        Promise.resolve([buildEventOdds({ id: `${sportKey}-1`, sport_key: sportKey })]),
      );
    const client = buildClient({ getOdds });
    const service = createEventsService({ client, sportKeys: ['soccer_epl', 'soccer_spain_la_liga'] });

    const matches = await service.listMatches();

    expect(getOdds).toHaveBeenCalledWith({ sportKey: 'soccer_epl' });
    expect(getOdds).toHaveBeenCalledWith({ sportKey: 'soccer_spain_la_liga' });
    expect(matches.map((match) => match.id).sort()).toEqual(['soccer_epl-1', 'soccer_spain_la_liga-1']);
    // Odds arrive in the same call - no separate per-match fetch needed.
    expect(matches[0]?.markets.length).toBeGreaterThan(0);
  });

  it('keeps events from the sport keys that succeed when another one fails', async () => {
    const getOdds = vi.fn().mockImplementation(({ sportKey }: { sportKey: string }) => {
      if (sportKey === 'soccer_spain_la_liga') {
        return Promise.reject(new Error('the-odds-api GET /sports/soccer_spain_la_liga/odds failed: 404'));
      }
      return Promise.resolve([buildEventOdds({ id: 'e1', sport_key: sportKey })]);
    });
    const client = buildClient({ getOdds });
    const service = createEventsService({ client, sportKeys: ['soccer_epl', 'soccer_spain_la_liga'] });

    const matches = await service.listMatches();

    expect(matches).toHaveLength(1);
    expect(matches[0]?.id).toBe('e1');
  });

  it('caches the merged events list and only refetches after the TTL', async () => {
    const getOdds = vi.fn().mockResolvedValue([buildEventOdds()]);
    const client = buildClient({ getOdds });
    let currentTime = 0;
    const service = createEventsService({ client, sportKeys: ['soccer_epl'], now: () => currentTime });

    await service.listMatches();
    await service.listMatches();
    expect(getOdds).toHaveBeenCalledTimes(1);

    currentTime = 24 * 60 * 60_000 + 1;
    await service.listMatches();
    expect(getOdds).toHaveBeenCalledTimes(2);
  });

  it('does not cache an empty result when every sport key request fails - retries on the very next call', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const getOdds = vi.fn().mockRejectedValue(new Error('the-odds-api GET /sports/soccer_epl/odds failed: 401'));
    const client = buildClient({ getOdds });
    const service = createEventsService({ client, sportKeys: ['soccer_epl'] });

    const first = await service.listMatches();
    expect(first).toEqual([]);
    const second = await service.listMatches();
    expect(second).toEqual([]);

    expect(getOdds).toHaveBeenCalledTimes(2);
    errorSpy.mockRestore();
  });

  it('looks up a single match from the cached list without an extra request', async () => {
    const getOdds = vi.fn().mockResolvedValue([buildEventOdds({ id: 'e1' })]);
    const client = buildClient({ getOdds });
    const service = createEventsService({ client, sportKeys: ['soccer_epl'] });

    await service.listMatches();
    const match = await service.getMatchOdds('e1');

    expect(getOdds).toHaveBeenCalledTimes(1);
    expect(match?.markets).toEqual([
      {
        id: 'match-result',
        name: 'Match Result',
        selections: [
          { id: 'home', name: 'Home', odds: 1.95 },
          { id: 'draw', name: 'Draw', odds: 3.6 },
          { id: 'away', name: 'Away', odds: 4.0 },
        ],
      },
    ]);
  });

  it('recomputes isLive fresh on every read from a cache hit, rather than freezing it at cache-population time', async () => {
    // Kicks off 30 minutes after the cache is first populated - well within
    // the 24h cache TTL, so every subsequent read for the rest of that
    // window must come from the cache, not a fresh fetch.
    const getOdds = vi
      .fn()
      .mockResolvedValue([buildEventOdds({ id: 'e1', commence_time: '2026-07-19T19:30:00Z' })]);
    const client = buildClient({ getOdds });
    let currentTime = new Date('2026-07-19T19:00:00Z').getTime();
    const service = createEventsService({ client, sportKeys: ['soccer_epl'], now: () => currentTime });

    const beforeKickoff = await service.listMatches();
    expect(beforeKickoff[0]?.isLive).toBe(false);

    // Still inside the 24h cache TTL - this must be served from cache.
    currentTime = new Date('2026-07-19T19:45:00Z').getTime();
    const afterKickoff = await service.listMatches();
    expect(getOdds).toHaveBeenCalledTimes(1);
    expect(afterKickoff[0]?.isLive).toBe(true);
  });

  it('returns undefined for an id that was never in the list', async () => {
    const client = buildClient();
    const service = createEventsService({ client, sportKeys: ['soccer_epl'] });

    const match = await service.getMatchOdds('unknown-id');
    expect(match).toBeUndefined();
  });
});

describe('verifySportKeys', () => {
  function buildSport(overrides: Partial<TheOddsApiSport> = {}): TheOddsApiSport {
    return {
      key: 'soccer_epl',
      group: 'Soccer',
      title: 'EPL',
      description: 'English Premier League',
      active: true,
      has_outrights: false,
      ...overrides,
    };
  }

  it('warns about configured keys that are missing or inactive', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const getSports = vi.fn().mockResolvedValue([buildSport({ key: 'soccer_epl', active: true })]);
    const client = buildClient({ getSports });

    await verifySportKeys(client, ['soccer_epl', 'soccer_made_up_league']);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('soccer_made_up_league'));
    warnSpy.mockRestore();
  });

  it('does not warn when every configured key is active', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const getSports = vi.fn().mockResolvedValue([buildSport({ key: 'soccer_epl', active: true })]);
    const client = buildClient({ getSports });

    await verifySportKeys(client, ['soccer_epl']);

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
