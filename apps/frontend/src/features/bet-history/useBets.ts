import { useQuery } from '@tanstack/react-query';
import { getBets } from '../../lib/backendApi';
import { useAuth } from '../auth/useAuth';

export const betsQueryKey = ['bets'] as const;

export function useBets() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: betsQueryKey,
    queryFn: getBets,
    enabled: isAuthenticated,
    // Bets settle server-side (trading/results feed) with the player just
    // sitting in the app, not from anything they click - poll so a pending
    // bet's status/payout catches up without needing a manual refresh, and
    // so useWinCelebrationDetector actually has something to detect.
    refetchInterval: 20_000,
  });
}
