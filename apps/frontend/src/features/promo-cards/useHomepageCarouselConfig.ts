import { useQuery } from '@tanstack/react-query';
import { getHomepageCarouselConfig } from '../../lib/backendApi';
import { useBrandStore } from '../brand/brandStore';

export function useHomepageCarouselConfig() {
  const brandId = useBrandStore((state) => state.brandId);

  return useQuery({
    queryKey: ['homepage-carousel-config', brandId],
    queryFn: () => getHomepageCarouselConfig(brandId as string),
    enabled: Boolean(brandId),
  });
}
