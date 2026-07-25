import { useQuery } from '@tanstack/react-query';
import { getPromoCards } from '../../lib/backendApi';
import { useBrandStore } from '../brand/brandStore';

export function usePromoCards() {
  const brandId = useBrandStore((state) => state.brandId);

  return useQuery({
    queryKey: ['promo-cards', brandId],
    queryFn: () => getPromoCards(brandId as string),
    enabled: Boolean(brandId),
  });
}
