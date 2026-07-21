import { useQuery } from '@tanstack/react-query';
import { getMarketSuspensions } from '../../lib/backendApi';
import { useBrandStore } from '../brand/brandStore';

/** Same cadence as useMatches - a suspension a trader lifts mid-match should reach the player app promptly. */
const REFETCH_INTERVAL_MS = 15_000;

export function useMarketSuspensions() {
  const brandId = useBrandStore((state) => state.brandId);

  const query = useQuery({
    queryKey: ['market-suspensions', brandId],
    queryFn: () => getMarketSuspensions(brandId as string),
    enabled: Boolean(brandId),
    refetchInterval: REFETCH_INTERVAL_MS,
  });

  /** True for a whole-match suspension (empty marketId) or one on this specific market. */
  function isSuspended(matchId: string, marketId: string): boolean {
    return (query.data ?? []).some(
      (suspension) =>
        suspension.matchId === matchId && (suspension.marketId === '' || suspension.marketId === marketId),
    );
  }

  return { ...query, isSuspended };
}
