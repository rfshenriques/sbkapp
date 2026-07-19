import { describe, expect, it } from 'vitest';
import type { Match } from '@sportsbook/shared';
import { buildSportTree, competitionCountryMap } from './buildSportTree';

function buildMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'm1',
    sport: 'Football',
    country: 'England',
    competition: 'Premier League',
    homeTeam: 'Home',
    awayTeam: 'Away',
    kickoff: '2026-07-19T18:00:00Z',
    isLive: false,
    markets: [],
    ...overrides,
  };
}

describe('buildSportTree', () => {
  it('groups matches into sport > country > competition with match counts', () => {
    const tree = buildSportTree([
      buildMatch({ id: 'm1', sport: 'Football', country: 'England', competition: 'Premier League' }),
      buildMatch({ id: 'm2', sport: 'Football', country: 'England', competition: 'Premier League' }),
      buildMatch({ id: 'm3', sport: 'Football', country: 'Spain', competition: 'La Liga' }),
      buildMatch({ id: 'm4', sport: 'Ice Hockey', country: 'USA', competition: 'NHL' }),
    ]);

    expect(tree).toEqual([
      {
        sport: 'Football',
        matchCount: 3,
        countries: [
          {
            country: 'England',
            matchCount: 2,
            competitions: [{ competition: 'Premier League', matchCount: 2 }],
          },
          {
            country: 'Spain',
            matchCount: 1,
            competitions: [{ competition: 'La Liga', matchCount: 1 }],
          },
        ],
      },
      {
        sport: 'Ice Hockey',
        matchCount: 1,
        countries: [
          {
            country: 'USA',
            matchCount: 1,
            competitions: [{ competition: 'NHL', matchCount: 1 }],
          },
        ],
      },
    ]);
  });

  it('puts Football, Tennis, and Basketball first in that order, ahead of other sports', () => {
    const tree = buildSportTree([
      buildMatch({ id: 'm1', sport: 'Boxing' }),
      buildMatch({ id: 'm2', sport: 'Basketball' }),
      buildMatch({ id: 'm3', sport: 'Tennis' }),
      buildMatch({ id: 'm4', sport: 'Football' }),
    ]);

    expect(tree.map((node) => node.sport)).toEqual(['Football', 'Tennis', 'Basketball', 'Boxing']);
  });

  it('sorts countries and competitions alphabetically within a sport', () => {
    const tree = buildSportTree([
      buildMatch({ id: 'm1', sport: 'Football', country: 'Spain', competition: 'La Liga' }),
      buildMatch({ id: 'm2', sport: 'Football', country: 'England', competition: 'Championship' }),
      buildMatch({ id: 'm3', sport: 'Football', country: 'England', competition: 'Premier League' }),
    ]);

    expect(tree[0]?.countries.map((c) => c.country)).toEqual(['England', 'Spain']);
    expect(tree[0]?.countries[0]?.competitions.map((c) => c.competition)).toEqual([
      'Championship',
      'Premier League',
    ]);
  });

  it('returns an empty array for no matches', () => {
    expect(buildSportTree([])).toEqual([]);
  });
});

describe('competitionCountryMap', () => {
  it('maps each competition to the country of its (first) match', () => {
    const map = competitionCountryMap([
      buildMatch({ id: 'm1', competition: 'Premier League', country: 'England' }),
      buildMatch({ id: 'm2', competition: 'La Liga', country: 'Spain' }),
    ]);

    expect(map.get('Premier League')).toBe('England');
    expect(map.get('La Liga')).toBe('Spain');
    expect(map.get('Unranked Cup')).toBeUndefined();
  });
});
