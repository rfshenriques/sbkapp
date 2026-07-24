import { useQuery } from '@tanstack/react-query';
import { getBetAndGetCampaignsForMatch } from '../../lib/backendApi';
import { useBrandStore } from '../brand/brandStore';

/** Backs the match-detail context banner - usually resolves to zero or one campaign, but nothing stops a trader from scoping two campaigns over the same match, so callers should render every one returned. */
export function useCampaignsForMatch(matchId: string | undefined) {
  const brandId = useBrandStore((state) => state.brandId);

  return useQuery({
    queryKey: ['bet-and-get-campaigns-for-match', brandId, matchId],
    queryFn: () => getBetAndGetCampaignsForMatch(brandId as string, matchId as string),
    enabled: Boolean(brandId) && Boolean(matchId),
  });
}
