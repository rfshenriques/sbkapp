import { describe, expect, it, vi } from 'vitest';
import { createEventsService, verifySportKeys } from './events-service';
import type { TheOddsApiClient } from './client';
import type { TheOddsApiEvent, TheOddsApiEventOdds, TheOddsApiSport } from './types';

function buildEvent(overrides: Partial<TheOddsApiEvent> = {}): TheOddsApiEvent {
  return {
    id: 'e1',
    sport_key: 'soccer_epl',
    sport_title: 'EPL',
    commence_time: '2026-07-19T19:00:00Z',
    home_team: 'Arsenal',
    away_team: 'Chelsea',
    ...overrides,
  };
}

function buildEventOdds(overrides: Partial<TheOddsApiEventOdds> = {}): TheOddsApiEventOdds {
  return {
    ...buildEvent(),
    bookmakers: [
      {
        key: 'betclic',
        title: 'Betclic',
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
    getEvents: vi.fn().mockResolvedValue([]),
    getEventOdds: vi.fn(),
    ...overrides,
  };
}

describe('createEventsService', () => {
  it('merges events from every configured sport key', async () => {
    const getEvents = vi
      .fn()
      .mockImplementation((sportKey: string) =>
        Promise.resolve([buildEvent({ id: `${sportKey}-1`, sport_key: sportKey })]),
      );
    const client = buildClient({ getEvents });
    const service = createEventsService({ client, sportKeys: ['soccer_epl', 'soccer_spain_la_liga'] });

    const matches = await service.listMatches();

    expect(getEvents).toHaveBeenCalledWith('soccer_epl');
    expect(getEvents).toHaveBeenCalledWith('soccer_spain_la_liga');
    expect(matches.map((match) => match.id).sort()).toEqual(['soccer_epl-1', 'soccer_spain_la_liga-1']);
  });

  it('keeps events from the sport keys that succeed when another one fails', async () => {
    const getEvents = vi.fn().mockImplementation((sportKey: string) => {
      if (sportKey === 'soccer_spain_la_liga') {
        return Promise.reject(new Error('the-odds-api GET /sports/soccer_spain_la_liga/events failed: 404'));
      }
      return Promise.resolve([buildEvent({ id: 'e1', sport_key: sportKey })]);
    });
    const client = buildClient({ getEvents });
    const service = createEventsService({ client, sportKeys: ['soccer_epl', 'soccer_spain_la_liga'] });

    const matches = await service.listMatches();

    expect(matches).toHaveLength(1);
    expect(matches[0]?.id).toBe('e1');
  });

  it('caches the merged events list and only refetches after the TTL', async () => {
    const getEvents = vi.fn().mockResolvedValue([buildEvent()]);
    const client = buildClient({ getEvents });
    let currentTime = 0;
    const service = createEventsService({ client, sportKeys: ['soccer_epl'], now: () => currentTime });

    await service.listMatches();
    await service.listMatches();
    expect(getEvents).toHaveBeenCalledTimes(1);

    currentTime = 5 * 60_000 + 1;
    await service.listMatches();
    expect(getEvents).toHaveBeenCalledTimes(2);
  });

  it('fetches odds for a single event using the sport key it was listed under', async () => {
    const getEvents = vi.fn().mockResolvedValue([buildEvent({ id: 'e1', sport_key: 'soccer_epl' })]);
    const getEventOdds = vi.fn().mockResolvedValue(buildEventOdds({ id: 'e1' }));
    const client = buildClient({ getEvents, getEventOdds });
    const service = createEventsService({ client, sportKeys: ['soccer_epl'] });

    await service.listMatches();
    const match = await service.getMatchOdds('e1');

    expect(getEventOdds).toHaveBeenCalledWith({ sportKey: 'soccer_epl', eventId: 'e1' });
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

  it('returns undefined for an event that was never listed (no sport key on record)', async () => {
    const client = buildClient();
    const service = createEventsService({ client, sportKeys: ['soccer_epl'] });

    const match = await service.getMatchOdds('unknown-id');
    expect(match).toBeUndefined();
  });

  it('falls back to the odds-less event when the provider rejects the odds request', async () => {
    const getEvents = vi.fn().mockResolvedValue([buildEvent({ id: 'e1', sport_key: 'soccer_epl' })]);
    const getEventOdds = vi.fn().mockRejectedValue(new Error('the-odds-api GET .../odds failed: 422'));
    const client = buildClient({ getEvents, getEventOdds });
    const service = createEventsService({ client, sportKeys: ['soccer_epl'] });

    await service.listMatches();
    const match = await service.getMatchOdds('e1');

    expect(match).toEqual(expect.objectContaining({ id: 'e1', markets: [] }));
  });

  it('caches per-event odds and only calls the client once within the TTL', async () => {
    const getEvents = vi.fn().mockResolvedValue([buildEvent({ id: 'e1', sport_key: 'soccer_epl' })]);
    const getEventOdds = vi.fn().mockResolvedValue(buildEventOdds({ id: 'e1' }));
    const client = buildClient({ getEvents, getEventOdds });
    let currentTime = 0;
    const service = createEventsService({ client, sportKeys: ['soccer_epl'], now: () => currentTime });

    await service.listMatches();
    await service.getMatchOdds('e1');
    await service.getMatchOdds('e1');
    expect(getEventOdds).toHaveBeenCalledTimes(1);

    currentTime = 2 * 60_000 + 1;
    await service.getMatchOdds('e1');
    expect(getEventOdds).toHaveBeenCalledTimes(2);
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
