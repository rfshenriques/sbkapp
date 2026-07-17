import { useQuery } from '@tanstack/react-query';
import { fetchMatchById } from '../../lib/oddsEngineApi';

export function matchQueryKey(matchId: string) {
  return ['match', matchId] as const;
}

export function useMatch(matchId: string | undefined) {
  return useQuery({
    queryKey: matchQueryKey(matchId ?? ''),
    queryFn: () => fetchMatchById(matchId ?? ''),
    enabled: Boolean(matchId),
  });
}
