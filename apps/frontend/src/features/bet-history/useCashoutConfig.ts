import { useQuery } from '@tanstack/react-query';
import { getCashoutConfig } from '../../lib/backendApi';
import { useBrandStore } from '../brand/brandStore';

const DEFAULT_CONFIG = {
  enabled: false,
  marginPercent: 0,
};

/** Falls back to "cashout off" defaults until the brand resolves or the fetch is still in flight - never blocks bet history from rendering. */
export function useCashoutConfig() {
  const brandId = useBrandStore((state) => state.brandId);

  const query = useQuery({
    queryKey: ['cashout-config', brandId],
    queryFn: () => getCashoutConfig(brandId as string),
    enabled: Boolean(brandId),
    staleTime: 60_000,
  });

  return query.data ?? DEFAULT_CONFIG;
}
