import { useQuery } from '@tanstack/react-query';
import { getCompetitionQuicklinks } from '../../lib/backendApi';
import { useBrandStore } from '../brand/brandStore';

export function useCompetitionQuicklinks() {
  const brandId = useBrandStore((state) => state.brandId);

  return useQuery({
    queryKey: ['competition-quicklinks', brandId],
    queryFn: () => getCompetitionQuicklinks(brandId as string),
    enabled: Boolean(brandId),
  });
}
