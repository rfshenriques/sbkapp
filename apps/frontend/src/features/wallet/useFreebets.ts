import { useQuery } from '@tanstack/react-query';
import { getFreebets, type Freebet } from '../../lib/backendApi';
import { useAuth } from '../auth/useAuth';

export const freebetsQueryKey = ['freebets'] as const;

export function useFreebets() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: freebetsQueryKey,
    queryFn: getFreebets,
    enabled: isAuthenticated,
    // Grants land server-side (campaign placement/settlement) with the
    // player just sitting in the app - poll so useFreebetGrantDetector
    // actually has something to detect, same reasoning as useBets.
    refetchInterval: 20_000,
  });
}

/** Total spendable freebets balance - the pooled wallet total shown in the header/bet slip, summed from each grant's remaining (not original) amount. */
export function sumFreebetsCents(freebets: Freebet[] | undefined): number {
  return (freebets ?? []).reduce((total, freebet) => total + freebet.remainingCents, 0);
}
