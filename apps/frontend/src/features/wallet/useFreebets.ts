import { useQuery } from '@tanstack/react-query';
import { getFreebets } from '../../lib/backendApi';
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
