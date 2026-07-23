import { useQuery } from '@tanstack/react-query';
import { getCompetitionSuspensions, getMarketSuspensions } from '../../lib/backendApi';
import { useBrandStore } from '../brand/brandStore';

/** Same cadence as useMatches - a suspension a trader lifts mid-match should reach the player app promptly. */
const REFETCH_INTERVAL_MS = 15_000;

export function useMarketSuspensions() {
  const brandId = useBrandStore((state) => state.brandId);

  const marketQuery = useQuery({
    queryKey: ['market-suspensions', brandId],
    queryFn: () => getMarketSuspensions(brandId as string),
    enabled: Boolean(brandId),
    refetchInterval: REFETCH_INTERVAL_MS,
  });

  const competitionQuery = useQuery({
    queryKey: ['competition-suspensions', brandId],
    queryFn: () => getCompetitionSuspensions(brandId as string),
    enabled: Boolean(brandId),
    refetchInterval: REFETCH_INTERVAL_MS,
  });

  /**
   * True for a whole-match suspension (empty marketId), a whole-market
   * suspension (empty selectionId), or - when selectionId is passed - an
   * exact-selection suspension. Omitting selectionId checks only the
   * coarser two, useful for a market-level "is anything here locked" check.
   */
  function isSuspended(matchId: string, marketId: string, selectionId?: string): boolean {
    return (marketQuery.data ?? []).some((suspension) => {
      if (suspension.matchId !== matchId) return false;
      if (suspension.marketId === '') return true;
      if (suspension.marketId !== marketId) return false;
      if (suspension.selectionId === '') return true;
      return selectionId !== undefined && suspension.selectionId === selectionId;
    });
  }

  function isCompetitionSuspended(competition: string): boolean {
    return (competitionQuery.data ?? []).includes(competition);
  }

  return {
    isPending: marketQuery.isPending || competitionQuery.isPending,
    isSuspended,
    isCompetitionSuspended,
  };
}
