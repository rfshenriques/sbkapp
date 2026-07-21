import { useQueryClient } from '@tanstack/react-query';
import { loadMatchDetailPage } from '../../app/routes';
import { matchQueryKey } from '../match-detail/useMatch';
import { getMatchById } from '../../lib/backendApi';
import { useBrandStore } from '../brand/brandStore';

/**
 * Warms both the match-detail route chunk and its data on touchstart/hover,
 * so navigating to a match card's detail page (per docs/PROJECT_BRIEF.md's
 * "instant feel" requirement) skips both the JS-chunk fetch and the loading
 * skeleton by the time the user actually taps through.
 */
export function usePrefetchMatchDetail() {
  const queryClient = useQueryClient();
  const brandId = useBrandStore((state) => state.brandId);

  return (matchId: string) => {
    if (!brandId) {
      return;
    }
    void loadMatchDetailPage();
    void queryClient.prefetchQuery({
      queryKey: matchQueryKey(matchId, brandId),
      queryFn: () => getMatchById(brandId, matchId),
    });
  };
}
