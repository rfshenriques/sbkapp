import { useQuery } from '@tanstack/react-query';
import { getBrandImageList, type BrandImageListKind } from '../../lib/backendApi';
import { useBrandStore } from '../brand/brandStore';

export function useBrandImageList(kind: BrandImageListKind) {
  const brandId = useBrandStore((state) => state.brandId);

  return useQuery({
    queryKey: ['brand-image-list', brandId, kind],
    queryFn: () => getBrandImageList(brandId as string, kind),
    enabled: Boolean(brandId),
  });
}
