import { useQuery } from '@tanstack/react-query';
import { getBetAndGetCampaigns } from '../../lib/backendApi';
import { useBrandStore } from '../brand/brandStore';

export function useBetAndGetCampaigns() {
  const brandId = useBrandStore((state) => state.brandId);

  return useQuery({
    queryKey: ['bet-and-get-campaigns', brandId],
    queryFn: () => getBetAndGetCampaigns(brandId as string),
    enabled: Boolean(brandId),
  });
}
