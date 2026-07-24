import { useQuery } from '@tanstack/react-query';
import { getSpecials } from '../../lib/backendApi';
import { useBrandStore } from '../brand/brandStore';

/** Same cadence as useMatches - a manual market a trader adds/edits should reach the player app promptly. */
const REFETCH_INTERVAL_MS = 15_000;

export function useSpecials() {
  const brandId = useBrandStore((state) => state.brandId);

  return useQuery({
    queryKey: ['specials', brandId],
    queryFn: () => getSpecials(brandId as string),
    enabled: Boolean(brandId),
    refetchInterval: REFETCH_INTERVAL_MS,
  });
}
