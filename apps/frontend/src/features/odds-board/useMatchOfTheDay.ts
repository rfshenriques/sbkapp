import { useQuery } from '@tanstack/react-query';
import { getMatchOfTheDay } from '../../lib/backendApi';
import { useBrandStore } from '../brand/brandStore';

export function useMatchOfTheDay() {
  const brandId = useBrandStore((state) => state.brandId);

  return useQuery({
    queryKey: ['match-of-the-day', brandId],
    queryFn: () => getMatchOfTheDay(brandId as string),
    enabled: Boolean(brandId),
  });
}
