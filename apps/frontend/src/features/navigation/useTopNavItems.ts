import { useQuery } from '@tanstack/react-query';
import { getTopNavItems } from '../../lib/backendApi';
import { useBrandStore } from '../brand/brandStore';

/** CMS-configured second navbar entries (see SecondaryNavBar) - staff-driven, so a longer staleTime than live match data is fine (same reasoning as useAccaBoostConfig/useCompetitionQuicklinks). */
export function useTopNavItems() {
  const brandId = useBrandStore((state) => state.brandId);

  return useQuery({
    queryKey: ['top-nav-items', brandId],
    queryFn: () => getTopNavItems(brandId as string),
    enabled: Boolean(brandId),
    staleTime: 60_000,
  });
}
