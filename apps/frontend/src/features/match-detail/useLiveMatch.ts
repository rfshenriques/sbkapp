import { useQuery } from '@tanstack/react-query';
import { fetchLiveMatch } from '../../lib/oddsEngineApi';

export function liveMatchQueryKey(matchId: string) {
  return ['live-match', matchId] as const;
}

/**
 * Only polled while the match is actually live - each poll just reads the
 * odds-engine's in-memory cache (see live-tracker-service), not the
 * external provider directly, so this doesn't add to its request budget
 * beyond the one poller already running server-side.
 */
export function useLiveMatch(matchId: string | undefined, isLive: boolean) {
  return useQuery({
    queryKey: liveMatchQueryKey(matchId ?? ''),
    queryFn: () => fetchLiveMatch(matchId ?? ''),
    enabled: Boolean(matchId) && isLive,
    refetchInterval: isLive ? 20_000 : false,
  });
}
