import { useQuery } from '@tanstack/react-query';
import { getLeaderboardCampaignEntries } from '../../lib/backendApi';
import { useAuth } from '../auth/useAuth';
import { useBrandStore } from '../brand/brandStore';

/**
 * Ranked, masked entries for one leaderboard - keyed on the viewer's own
 * auth state too, since the same request returns a different shape (the
 * viewer's own row unmasked) once a player logs in or out.
 */
export function useLeaderboardEntries(campaignId: string | undefined) {
  const brandId = useBrandStore((state) => state.brandId);
  const { accessToken } = useAuth();

  return useQuery({
    queryKey: ['leaderboard-campaign-entries', brandId, campaignId, accessToken],
    queryFn: () => getLeaderboardCampaignEntries(brandId as string, campaignId as string),
    enabled: Boolean(brandId) && Boolean(campaignId),
  });
}
