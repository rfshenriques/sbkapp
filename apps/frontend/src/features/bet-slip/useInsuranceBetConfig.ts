import { useQuery } from '@tanstack/react-query';
import { getInsuranceBetConfig } from '../../lib/backendApi';
import { useBrandStore } from '../brand/brandStore';

const DEFAULT_CONFIG = {
  costPercent: 0,
  enabled: false,
  minOdds: 1,
};

/** Falls back to "insurance off" defaults until the brand resolves or the fetch is still in flight - never blocks the bet slip from rendering. */
export function useInsuranceBetConfig() {
  const brandId = useBrandStore((state) => state.brandId);

  const query = useQuery({
    queryKey: ['insurance-bet-config', brandId],
    queryFn: () => getInsuranceBetConfig(brandId as string),
    enabled: Boolean(brandId),
    staleTime: 60_000,
  });

  return query.data ?? DEFAULT_CONFIG;
}
