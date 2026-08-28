import { describe, expect, it, vi } from 'vitest';
import { createMergedEventsService, isSameGame, mergeMatches, pickBetterMatch } from './merged-events-service';
import type { EventsService } from './the-odds-api/events-service';
import type { Match } from '@sportsbook/shared';

function buildMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'a1',
    sport: 'Football',
    country: 'England',
    competition: 'EPL',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    kickoff: '2026-08-28T19:00:00Z',
    isLive: false,
    markets: [
      {
        id: 'match-result',
        name: 'Match Result',
        selections: [
          { id: 'home', name: 'Home', odds: 1.95 },
          { id: 'draw', name: 'Draw', odds: 3.6 },
          { id: 'away', name: 'Away', odds: 4.0 },
        ],
      },
    ],
    ...overrides,
  };
}

function buildService(listMatches: () => Promise<Match[]>): EventsService {
  return {
    listMatches,
    getMatchOdds: async (eventId) => (await listMatches()).find((match) => match.id === eventId),
  };
}

describe('isSameGame', () => {
  it('matches the same two teams within the kickoff tolerance', () => {
    const a = buildMatch({ homeTeam: 'Manchester City', kickoff: '2026-08-28T19:00:00Z' });
    const b = buildMatch({ id: 'therundown:b1', homeTeam: 'Manchester City', kickoff: '2026-08-28T19:05:00Z' });
    expect(isSameGame(a, b)).toBe(true);
  });

  it('matches a name carrying a trailing suffix the other omits', () => {
    const a = buildMatch({ homeTeam: 'Manchester City' });
    const b = buildMatch({ id: 'therundown:b1', homeTeam: 'Manchester City FC' });
    expect(isSameGame(a, b)).toBe(true);
  });

  it('does not match different sports', () => {
    const a = buildMatch({ sport: 'Football' });
    const b = buildMatch({ id: 'therundown:b1', sport: 'Ice Hockey' });
    expect(isSameGame(a, b)).toBe(false);
  });

  it('does not match kickoffs further apart than the tolerance', () => {
    const a = buildMatch({ kickoff: '2026-08-28T19:00:00Z' });
    const b = buildMatch({ id: 'therundown:b1', kickoff: '2026-08-28T20:00:00Z' });
    expect(isSameGame(a, b)).toBe(false);
  });

  it('does not match different teams', () => {
    const a = buildMatch({ homeTeam: 'Arsenal' });
    const b = buildMatch({ id: 'therundown:b1', homeTeam: 'Liverpool' });
    expect(isSameGame(a, b)).toBe(false);
  });
});

describe('pickBetterMatch', () => {
  it('picks the match whose match-result market has the lower overround', () => {
    // Tighter market: 1/1.95 + 1/3.6 + 1/4.0 ≈ 1.036
    const tighter = buildMatch({ id: 'tight' });
    // Looser market: overround ≈ 1.30
    const looser = buildMatch({
      id: 'loose',
      markets: [
        {
          id: 'match-result',
          name: 'Match Result',
          selections: [
            { id: 'home', name: 'Home', odds: 1.3 },
            { id: 'draw', name: 'Draw', odds: 2.5 },
            { id: 'away', name: 'Away', odds: 3.0 },
          ],
        },
      ],
    });

    expect(pickBetterMatch(tighter, looser).id).toBe('tight');
    expect(pickBetterMatch(looser, tighter).id).toBe('tight');
  });

  it('picks whichever match actually has a priced match-result market', () => {
    const priced = buildMatch({ id: 'priced' });
    const unpriced = buildMatch({ id: 'unpriced', markets: [] });

    expect(pickBetterMatch(priced, unpriced).id).toBe('priced');
    expect(pickBetterMatch(unpriced, priced).id).toBe('priced');
  });
});

describe('mergeMatches', () => {
  it('keeps a match from each provider unchanged when they do not overlap', () => {
    const a = buildMatch({ id: 'a1', homeTeam: 'Arsenal', awayTeam: 'Chelsea' });
    const b = buildMatch({ id: 'therundown:b1', homeTeam: 'Liverpool', awayTeam: 'Everton' });

    const merged = mergeMatches([a], [b]);

    expect(merged.map((match) => match.id).sort()).toEqual(['a1', 'therundown:b1']);
  });

  it('collapses two matches covering the same game into one', () => {
    const a = buildMatch({ id: 'a1' });
    const b = buildMatch({ id: 'therundown:b1' });

    const merged = mergeMatches([a], [b]);

    expect(merged).toHaveLength(1);
  });

  it('never matches the same b-side game to more than one a-side match', () => {
    const a1 = buildMatch({ id: 'a1' });
    const a2 = buildMatch({ id: 'a2' }); // same fixture appearing twice on the a side, unlikely but shouldn't double-consume b
    const b1 = buildMatch({ id: 'therundown:b1' });

    const merged = mergeMatches([a1, a2], [b1]);

    // a1 consumes b1; a2 has nothing left to merge with and passes through separately.
    expect(merged).toHaveLength(2);
  });
});

describe('createMergedEventsService', () => {
  it('merges matches from both providers', async () => {
    const providerA = buildService(async () => [buildMatch({ id: 'a1', homeTeam: 'Arsenal', awayTeam: 'Chelsea' })]);
    const providerB = buildService(async () => [buildMatch({ id: 'therundown:b1', homeTeam: 'Liverpool', awayTeam: 'Everton' })]);
    const service = createMergedEventsService([providerA, providerB]);

    const matches = await service.listMatches();

    expect(matches.map((match) => match.id).sort()).toEqual(['a1', 'therundown:b1']);
  });

  it('keeps serving one provider\'s matches when the other throws entirely', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const providerA = buildService(async () => [buildMatch({ id: 'a1' })]);
    const providerB = buildService(async () => {
      throw new Error('provider down');
    });
    const service = createMergedEventsService([providerA, providerB]);

    const matches = await service.listMatches();

    expect(matches.map((match) => match.id)).toEqual(['a1']);
    errorSpy.mockRestore();
  });

  it('getMatchOdds finds a match by id from the merged list', async () => {
    const providerA = buildService(async () => [buildMatch({ id: 'a1' })]);
    const providerB = buildService(async () => []);
    const service = createMergedEventsService([providerA, providerB]);

    const match = await service.getMatchOdds('a1');
    expect(match?.id).toBe('a1');

    const missing = await service.getMatchOdds('nope');
    expect(missing).toBeUndefined();
  });
});
