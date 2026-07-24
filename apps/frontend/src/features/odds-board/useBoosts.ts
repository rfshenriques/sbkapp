import { useQuery } from '@tanstack/react-query';
import { getBoosts } from '../../lib/backendApi';
import { useBrandStore } from '../brand/brandStore';

/** Same cadence as useMatches - a boost a trader sets/clears, or one that auto-disables on hitting its liability cap, should reach the player app promptly. */
const REFETCH_INTERVAL_MS = 15_000;

export function useBoosts() {
  const brandId = useBrandStore((state) => state.brandId);

  return useQuery({
    queryKey: ['boosts', brandId],
    queryFn: () => getBoosts(brandId as string),
    enabled: Boolean(brandId),
    refetchInterval: REFETCH_INTERVAL_MS,
  });
}
