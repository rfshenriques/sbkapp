import { useQueryClient } from '@tanstack/react-query';
import { loadMatchDetailPage } from '../../app/routes';
import { matchQueryKey } from '../match-detail/useMatch';
import { fetchMatchById } from '../../lib/oddsEngineApi';

/**
 * Warms both the match-detail route chunk and its data on touchstart/hover,
 * so navigating to a match card's detail page (per docs/PROJECT_BRIEF.md's
 * "instant feel" requirement) skips both the JS-chunk fetch and the loading
 * skeleton by the time the user actually taps through.
 */
export function usePrefetchMatchDetail() {
  const queryClient = useQueryClient();

  return (matchId: string) => {
    void loadMatchDetailPage();
    void queryClient.prefetchQuery({
      queryKey: matchQueryKey(matchId),
      queryFn: () => fetchMatchById(matchId),
    });
  };
}
