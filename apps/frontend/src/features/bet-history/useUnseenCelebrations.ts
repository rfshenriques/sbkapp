import { useQuery } from '@tanstack/react-query';
import { getUnseenCelebrations } from '../../lib/backendApi';
import { useAuth } from '../auth/useAuth';

/**
 * WON bets and freebet grants the player hasn't yet been shown a celebration
 * for - fetched once per login (not polled, unlike useBets()/useFreebets())
 * so useWinCelebrationDetector and useFreebetGrantDetector can catch up on
 * anything that happened while the player wasn't logged in at all, including
 * across an app refresh that remounts both hooks. Shared by both detectors
 * via the same query key, so React Query dedupes the network request/cache
 * into a single fetch instead of one per hook. Keyed by user id (not just
 * 'unseen-celebrations') so a logout/login as a different player on the same
 * device never serves the previous player's cached, unacknowledged list.
 */
export function useUnseenCelebrations() {
  const { isAuthenticated, user } = useAuth();
  return useQuery({
    queryKey: ['unseen-celebrations', user?.sub ?? null] as const,
    queryFn: getUnseenCelebrations,
    enabled: isAuthenticated,
  });
}
