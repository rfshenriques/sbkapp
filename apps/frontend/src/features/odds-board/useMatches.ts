import { useQuery } from '@tanstack/react-query';
import { fetchMatches } from '../../mocks/api';

export function useMatches() {
  return useQuery({
    queryKey: ['matches'],
    queryFn: fetchMatches,
  });
}
