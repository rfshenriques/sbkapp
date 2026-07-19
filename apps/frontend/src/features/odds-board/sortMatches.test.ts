import { describe, expect, it } from 'vitest';
import type { Match } from '@sportsbook/shared';
import { rankMapFromRankings, sortMatches } from './sortMatches';

function buildMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'm1',
    sport: 'Football',
    competition: 'EPL',
    homeTeam: 'Home',
    awayTeam: 'Away',
    kickoff: '2026-07-19T18:00:00Z',
    isLive: false,
    markets: [],
    ...overrides,
  };
}

describe('sortMatches', () => {
  it('always puts live matches first regardless of mode', () => {
    const matches = [
      buildMatch({ id: 'pre', isLive: false, kickoff: '2026-07-19T10:00:00Z' }),
      buildMatch({ id: 'live', isLive: true, kickoff: '2026-07-19T20:00:00Z' }),
    ];

    expect(sortMatches(matches, 'time').map((m) => m.id)).toEqual(['live', 'pre']);
    expect(sortMatches(matches, 'importance').map((m) => m.id)).toEqual(['live', 'pre']);
  });

  it('"time" mode sorts by soonest kickoff', () => {
    const matches = [
      buildMatch({ id: 'later', kickoff: '2026-07-20T10:00:00Z', competition: 'EPL' }),
      buildMatch({ id: 'sooner', kickoff: '2026-07-19T10:00:00Z', competition: 'League Two' }),
    ];

    expect(sortMatches(matches, 'time').map((m) => m.id)).toEqual(['sooner', 'later']);
  });

  it('"importance" mode sorts by rank, ignoring kickoff order', () => {
    const matches = [
      buildMatch({ id: 'minor', competition: 'League Two', kickoff: '2026-07-19T09:00:00Z' }),
      buildMatch({ id: 'major', competition: 'Champions League', kickoff: '2026-07-19T22:00:00Z' }),
    ];
    const rankByCompetition = rankMapFromRankings([
      { competition: 'Champions League', rank: 0 },
      { competition: 'League Two', rank: 20 },
    ]);

    expect(sortMatches(matches, 'importance', rankByCompetition).map((m) => m.id)).toEqual([
      'major',
      'minor',
    ]);
  });

  it('"importance" mode falls back to kickoff time for unranked competitions', () => {
    const matches = [
      buildMatch({ id: 'later', competition: 'Unranked League', kickoff: '2026-07-20T10:00:00Z' }),
      buildMatch({ id: 'sooner', competition: 'Another Unranked League', kickoff: '2026-07-19T10:00:00Z' }),
    ];

    expect(sortMatches(matches, 'importance', new Map()).map((m) => m.id)).toEqual([
      'sooner',
      'later',
    ]);
  });

  it('ranked competitions sort ahead of unranked ones in importance mode', () => {
    const matches = [
      buildMatch({ id: 'unranked', competition: 'Unranked League', kickoff: '2026-07-19T09:00:00Z' }),
      buildMatch({ id: 'ranked', competition: 'EPL', kickoff: '2026-07-19T23:00:00Z' }),
    ];
    const rankByCompetition = rankMapFromRankings([{ competition: 'EPL', rank: 0 }]);

    expect(sortMatches(matches, 'importance', rankByCompetition).map((m) => m.id)).toEqual([
      'ranked',
      'unranked',
    ]);
  });
});
