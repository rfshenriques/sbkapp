import { useQuery } from '@tanstack/react-query';
import { getLeaderboardCampaignsForMatch } from '../../lib/backendApi';
import { useBrandStore } from '../brand/brandStore';

/** Backs the match-detail context banner - usually zero or one leaderboard, but nothing stops a trader from scoping several over the same match. */
export function useLeaderboardsForMatch(matchId: string | undefined) {
  const brandId = useBrandStore((state) => state.brandId);

  return useQuery({
    queryKey: ['leaderboard-campaigns-for-match', brandId, matchId],
    queryFn: () => getLeaderboardCampaignsForMatch(brandId as string, matchId as string),
    enabled: Boolean(brandId) && Boolean(matchId),
  });
}
