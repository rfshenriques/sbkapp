import { useQuery } from '@tanstack/react-query';
import { getWallet } from '../../lib/backendApi';
import { useAuth } from '../auth/useAuth';

export const walletQueryKey = ['wallet'] as const;

export function useWallet() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: walletQueryKey,
    queryFn: getWallet,
    enabled: isAuthenticated,
  });
}

/**
 * Wallet balances only need decimals when they're not already a round
 * amount (43 €, 5400 €) - forcing ".00" on every value made the header's
 * cash + freebets pills collide once a 6-figure cash balance sat next to a
 * 4-figure freebets one (see BalancePills). A genuinely fractional amount
 * (43.50 €, 34.56 €) still shows its decimals - this only ever drops
 * trailing zeros, never real precision.
 */
export function formatCents(cents: number): string {
  const euros = cents / 100;
  return Number.isInteger(euros) ? euros.toFixed(0) : euros.toFixed(2);
}
