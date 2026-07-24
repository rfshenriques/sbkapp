import { describe, expect, it } from 'vitest';
import type { Match } from '@sportsbook/shared';
import { buildMatchTree } from './matchTree';

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

describe('buildMatchTree', () => {
  it('groups matches into sport > country > league > match, with counts at each level', () => {
    const m1 = buildMatch({ id: 'm1', sport: 'Football', country: 'England', competition: 'Premier League' });
    const m2 = buildMatch({ id: 'm2', sport: 'Football', country: 'England', competition: 'Premier League' });
    const m3 = buildMatch({ id: 'm3', sport: 'Football', country: 'Spain', competition: 'La Liga' });
    const m4 = buildMatch({ id: 'm4', sport: 'Ice Hockey', country: 'USA', competition: 'NHL' });

    const tree = buildMatchTree([m1, m2, m3, m4]);

    expect(tree).toEqual([
      {
        sport: 'Football',
        matchCount: 3,
        countries: [
          {
            country: 'England',
            matchCount: 2,
            competitions: [{ competition: 'Premier League', matches: [m1, m2] }],
          },
          {
            country: 'Spain',
            matchCount: 1,
            competitions: [{ competition: 'La Liga', matches: [m3] }],
          },
        ],
      },
      {
        sport: 'Ice Hockey',
        matchCount: 1,
        countries: [{ country: 'USA', matchCount: 1, competitions: [{ competition: 'NHL', matches: [m4] }] }],
      },
    ]);
  });

  it('puts Football, Tennis, and Basketball first in that order, ahead of other sports', () => {
    const tree = buildMatchTree([
      buildMatch({ sport: 'Darts' }),
      buildMatch({ sport: 'Basketball' }),
      buildMatch({ sport: 'Tennis' }),
      buildMatch({ sport: 'Football' }),
    ]);

    expect(tree.map((node) => node.sport)).toEqual(['Football', 'Tennis', 'Basketball', 'Darts']);
  });

  it('sorts countries and competitions alphabetically', () => {
    const tree = buildMatchTree([
      buildMatch({ sport: 'Football', country: 'Spain', competition: 'La Liga' }),
      buildMatch({ sport: 'Football', country: 'England', competition: 'Championship' }),
      buildMatch({ sport: 'Football', country: 'England', competition: 'Premier League' }),
    ]);

    expect(tree[0]?.countries.map((c) => c.country)).toEqual(['England', 'Spain']);
    expect(tree[0]?.countries[0]?.competitions.map((c) => c.competition)).toEqual([
      'Championship',
      'Premier League',
    ]);
  });

  it('returns an empty tree for no matches', () => {
    expect(buildMatchTree([])).toEqual([]);
  });
});
