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
  });
}
