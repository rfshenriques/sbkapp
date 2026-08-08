import { useQuery } from '@tanstack/react-query';
import { getLeaderboardCampaign } from '../../lib/backendApi';
import { useBrandStore } from '../brand/brandStore';

export function useLeaderboardCampaign(campaignId: string | undefined) {
  const brandId = useBrandStore((state) => state.brandId);

  return useQuery({
    queryKey: ['leaderboard-campaign', brandId, campaignId],
    queryFn: () => getLeaderboardCampaign(brandId as string, campaignId as string),
    enabled: Boolean(brandId) && Boolean(campaignId),
  });
}
