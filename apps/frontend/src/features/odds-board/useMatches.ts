import { useQuery } from '@tanstack/react-query';
import { fetchMatches } from '../../lib/oddsEngineApi';

export function useMatches() {
  return useQuery({
    queryKey: ['matches'],
    queryFn: fetchMatches,
  });
}
