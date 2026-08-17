import { useQuery } from '@tanstack/react-query';
import { getWallet } from '../../lib/backendApi';
import { formatMoneySmart } from '../../lib/currency';
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
 * trailing zeros, never real precision. Includes the active brand's
 * currency symbol (see lib/currency.ts) - callers should not append their
 * own "€" after this anymore.
 */
export function formatCents(cents: number): string {
  return formatMoneySmart(cents);
}
