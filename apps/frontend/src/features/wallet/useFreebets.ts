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
  });
}

/** Total spendable freebet balance - what the header/bet slip balance display shows, distinct from any single freebet's own amount. */
export function sumFreebetsCents(freebets: Freebet[] | undefined): number {
  return (freebets ?? []).reduce((total, freebet) => total + freebet.amountCents, 0);
}
