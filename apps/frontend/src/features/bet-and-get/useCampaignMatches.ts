import { useQuery } from '@tanstack/react-query';
import { getBetAndGetCampaignMatches } from '../../lib/backendApi';
import { useBrandStore } from '../brand/brandStore';

export function useCampaignMatches(campaignId: string | undefined) {
  const brandId = useBrandStore((state) => state.brandId);

  return useQuery({
    queryKey: ['bet-and-get-campaign-matches', brandId, campaignId],
    queryFn: () => getBetAndGetCampaignMatches(brandId as string, campaignId as string),
    enabled: Boolean(brandId) && Boolean(campaignId),
  });
}
