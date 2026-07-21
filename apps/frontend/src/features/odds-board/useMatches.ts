import { useQuery } from '@tanstack/react-query';
import { getMatches } from '../../lib/backendApi';
import { useBrandStore } from '../brand/brandStore';

/** Odds can move between polls (feed price changes, a trader edits margin) - short enough that the price-flash animation feels alive, long enough not to hammer the backend. */
const REFETCH_INTERVAL_MS = 15_000;

export function useMatches() {
  const brandId = useBrandStore((state) => state.brandId);

  return useQuery({
    queryKey: ['matches', brandId],
    queryFn: () => getMatches(brandId as string),
    enabled: Boolean(brandId),
    refetchInterval: REFETCH_INTERVAL_MS,
  });
}
