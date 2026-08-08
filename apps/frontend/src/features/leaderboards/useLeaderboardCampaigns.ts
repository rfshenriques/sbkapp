import { useQuery } from '@tanstack/react-query';
import { getLeaderboardCampaigns } from '../../lib/backendApi';
import { useBrandStore } from '../brand/brandStore';

export function useLeaderboardCampaigns() {
  const brandId = useBrandStore((state) => state.brandId);

  return useQuery({
    queryKey: ['leaderboard-campaigns', brandId],
    queryFn: () => getLeaderboardCampaigns(brandId as string),
    enabled: Boolean(brandId),
  });
}
