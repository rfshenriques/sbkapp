import { useQuery } from '@tanstack/react-query';
import { previewStakeLimit, type PlaceBetSelection } from '../../lib/backendApi';
import { useAuthStore } from '../auth/authStore';
import { useBrandStore } from '../brand/brandStore';

function selectionsKey(selections: PlaceBetSelection[]): string {
  return selections.map((selection) => `${selection.matchId}:${selection.marketId}:${selection.selectionId}:${selection.odds}`).join('|');
}

/**
 * The bet slip's live preview of what PamService would allow for this
 * exact set of selections (see StakeLimitAlert in BetSlipPanel.tsx) -
 * returns null while loading/disabled so callers just skip rendering an
 * alert rather than showing a stale or fabricated cap. Keyed on the
 * access token too: a PLAYER-scoped cap only ever applies once logged in,
 * so the preview needs to refetch across a login/logout, not just a brand
 * change.
 */
export function useStakeLimitPreview(selections: PlaceBetSelection[]) {
  const brandId = useBrandStore((state) => state.brandId);
  const accessToken = useAuthStore((state) => state.accessToken);

  const query = useQuery({
    queryKey: ['stake-limit-preview', brandId, accessToken, selectionsKey(selections)],
    queryFn: () => previewStakeLimit(brandId as string, selections),
    enabled: Boolean(brandId) && selections.length > 0,
    staleTime: 15_000,
  });

  return query.data ?? null;
}
