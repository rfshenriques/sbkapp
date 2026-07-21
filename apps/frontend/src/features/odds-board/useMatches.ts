import { useQuery } from '@tanstack/react-query';
import { getMatches } from '../../lib/backendApi';
import { useBrandStore } from '../brand/brandStore';

export function useMatches() {
  const brandId = useBrandStore((state) => state.brandId);

  return useQuery({
    queryKey: ['matches', brandId],
    queryFn: () => getMatches(brandId as string),
    enabled: Boolean(brandId),
  });
}
