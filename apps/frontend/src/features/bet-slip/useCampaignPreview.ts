import { useQuery } from '@tanstack/react-query';
import { previewCampaign, type PlaceBetSelection } from '../../lib/backendApi';
import { useAuthStore } from '../auth/authStore';
import { useBrandStore } from '../brand/brandStore';

function selectionsKey(selections: PlaceBetSelection[]): string {
  return selections.map((selection) => `${selection.matchId}:${selection.marketId}:${selection.selectionId}:${selection.odds}`).join('|');
}

/**
 * The bet slip's live preview of which campaign(s), if any, this exact bet
 * (selections + stake) would link to at placement (see
 * CampaignQualificationNote in BetSlipPanel.tsx) - same shape/soft-auth
 * behavior as useStakeLimitPreview, with stakeCents added to both the
 * request and the query key since a campaign's own conditions (and a
 * deposit campaign's percentage-derived reward) can depend on it.
 */
export function useCampaignPreview(selections: PlaceBetSelection[], stakeCents: number) {
  const brandId = useBrandStore((state) => state.brandId);
  const accessToken = useAuthStore((state) => state.accessToken);

  const query = useQuery({
    queryKey: ['campaign-preview', brandId, accessToken, selectionsKey(selections), stakeCents],
    queryFn: () => previewCampaign(brandId as string, selections, stakeCents),
    enabled: Boolean(brandId) && selections.length > 0 && stakeCents > 0,
    staleTime: 15_000,
  });

  return query.data ?? null;
}
