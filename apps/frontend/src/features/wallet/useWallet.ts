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

export function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}
