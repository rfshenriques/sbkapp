import { useQuery } from '@tanstack/react-query';
import { getAccaRollbackConfig } from '../../lib/backendApi';
import { useBrandStore } from '../brand/brandStore';

const DEFAULT_CONFIG = {
  minSelections: 2,
  lossThreshold: 0,
  rewardPercent: 0,
  enabled: false,
};

/** Falls back to "rollback off" defaults until the brand resolves or the fetch is still in flight - never blocks the bet slip from rendering. */
export function useAccaRollbackConfig() {
  const brandId = useBrandStore((state) => state.brandId);

  const query = useQuery({
    queryKey: ['acca-rollback-config', brandId],
    queryFn: () => getAccaRollbackConfig(brandId as string),
    enabled: Boolean(brandId),
    staleTime: 60_000,
  });

  return query.data ?? DEFAULT_CONFIG;
}
