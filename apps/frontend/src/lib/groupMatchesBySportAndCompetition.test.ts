import { describe, expect, it } from 'vitest';
import type { Match } from '@sportsbook/shared';
import { groupMatchesBySportAndCompetition } from './groupMatchesBySportAndCompetition';

function buildMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'match-1',
    sport: 'Football',
    country: 'England',
    competition: 'Premier League',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    kickoff: '2026-07-25T15:00:00Z',
    isLive: false,
    markets: [],
    ...overrides,
  };
}

describe('groupMatchesBySportAndCompetition', () => {
  it('returns an empty array for no matches', () => {
    expect(groupMatchesBySportAndCompetition([])).toEqual([]);
  });

  it('groups matches under their sport, then their competition', () => {
    const groups = groupMatchesBySportAndCompetition([
      buildMatch({ id: 'match-1', sport: 'Football', competition: 'Premier League' }),
      buildMatch({ id: 'match-2', sport: 'Football', competition: 'Champions League' }),
      buildMatch({ id: 'match-3', sport: 'Basketball', competition: 'NBA' }),
    ]);

    expect(groups).toEqual([
      {
        sport: 'Football',
        competitions: [
          { competition: 'Premier League', matches: [expect.objectContaining({ id: 'match-1' })] },
          { competition: 'Champions League', matches: [expect.objectContaining({ id: 'match-2' })] },
        ],
      },
      {
        sport: 'Basketball',
        competitions: [{ competition: 'NBA', matches: [expect.objectContaining({ id: 'match-3' })] }],
      },
    ]);
  });

  it('keeps every match from the same competition together, in their original order', () => {
    const groups = groupMatchesBySportAndCompetition([
      buildMatch({ id: 'match-1' }),
      buildMatch({ id: 'match-2' }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.competitions).toHaveLength(1);
    expect(groups[0]!.competitions[0]!.matches.map((match) => match.id)).toEqual(['match-1', 'match-2']);
  });
});
