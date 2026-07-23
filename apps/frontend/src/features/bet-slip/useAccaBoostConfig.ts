import { useQuery } from '@tanstack/react-query';
import { getAccaBoostConfig } from '../../lib/backendApi';
import { useBrandStore } from '../brand/brandStore';

const DEFAULT_CONFIG = {
  boostPercentPerLeg: 0,
  minSelections: 2,
  minOddsPerLeg: 1.01,
  enabled: false,
};

/** Falls back to "boost off" defaults until the brand resolves or the fetch is still in flight - never blocks the bet slip from rendering. */
export function useAccaBoostConfig() {
  const brandId = useBrandStore((state) => state.brandId);

  const query = useQuery({
    queryKey: ['acca-boost-config', brandId],
    queryFn: () => getAccaBoostConfig(brandId as string),
    enabled: Boolean(brandId),
    staleTime: 60_000,
  });

  return query.data ?? DEFAULT_CONFIG;
}
