import { useQuery } from '@tanstack/react-query';
import { fetchLiveScoreboard } from '../../lib/oddsEngineApi';

export const LIVE_SCOREBOARD_QUERY_KEY = ['live-scoreboard'] as const;

/**
 * One shared subscription for every live match's score/clock at once (see
 * apps/odds-engine's LiveScoreboardService) - React Query dedupes the fixed
 * query key across every MatchCard/LiveMatchChip instance that calls this,
 * so rendering a whole page of live matches still costs exactly one fetch,
 * not one per card. Prefer this over useLiveMatch (the detailed single-
 * match events/stats tracker) anywhere that just needs "what's the score
 * and what minute is it" for a match card or list - useLiveMatch's
 * server-side tracker only ever follows one match at a time, so several
 * cards each calling it independently would just keep evicting each
 * other's tracked match. The server's own refresh cadence is coarse
 * (~10 min, to stay inside api-sports' free-tier daily quota - see
 * LiveScoreboardService), refetched here more often since a read is just
 * the server's in-memory cache, not a new provider request.
 */
export function useLiveScoreboard() {
  return useQuery({
    queryKey: LIVE_SCOREBOARD_QUERY_KEY,
    queryFn: fetchLiveScoreboard,
    refetchInterval: 60_000,
  });
}
