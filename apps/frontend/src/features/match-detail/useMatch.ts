import { useQuery } from '@tanstack/react-query';
import { getMatchById } from '../../lib/backendApi';
import { useBrandStore } from '../brand/brandStore';

export function matchQueryKey(matchId: string, brandId?: string) {
  return ['match', matchId, brandId] as const;
}

export function useMatch(matchId: string | undefined) {
  const brandId = useBrandStore((state) => state.brandId);

  return useQuery({
    queryKey: matchQueryKey(matchId ?? '', brandId),
    queryFn: () => getMatchById(brandId as string, matchId ?? ''),
    enabled: Boolean(matchId) && Boolean(brandId),
  });
}
