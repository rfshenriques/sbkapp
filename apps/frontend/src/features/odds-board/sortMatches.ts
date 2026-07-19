import type { Match } from '@sportsbook/shared';

export type MatchSortMode = 'time' | 'importance';

/**
 * Live matches always sort first regardless of mode. Within that, "time"
 * sorts by kickoff; "importance" sorts by the staff-configured competition
 * rank (see useCompetitionRankings), falling back to kickoff for
 * unranked competitions or a tie.
 */
export function sortMatches(
  matches: Match[],
  mode: MatchSortMode,
  rankByCompetition: Map<string, number> = new Map(),
): Match[] {
  const rankFor = (competition: string) => rankByCompetition.get(competition) ?? Number.MAX_SAFE_INTEGER;

  return [...matches].sort((a, b) => {
    if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;

    if (mode === 'importance') {
      const rankDiff = rankFor(a.competition) - rankFor(b.competition);
      if (rankDiff !== 0) return rankDiff;
    }

    return new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime();
  });
}

export function rankMapFromRankings(rankings: { competition: string; rank: number }[]): Map<string, number> {
  return new Map(rankings.map((ranking) => [ranking.competition, ranking.rank]));
}
