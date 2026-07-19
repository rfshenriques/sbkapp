import { useQuery } from '@tanstack/react-query';
import { getCompetitionRankings } from '../../lib/backendApi';
import { useBrandStore } from '../brand/brandStore';

export function useCompetitionRankings() {
  const brandId = useBrandStore((state) => state.brandId);

  return useQuery({
    queryKey: ['competition-rankings', brandId],
    queryFn: () => getCompetitionRankings(brandId as string),
    enabled: Boolean(brandId),
  });
}
