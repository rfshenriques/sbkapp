import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTeamColors } from '../../lib/backendApi';

/**
 * name -> 3-letter acronym, for teams a staff member has set one for on the
 * Team Colors backoffice page. Teams with no acronym set simply aren't in
 * the map - callers must not fabricate one (see TeamBadge's own auto-
 * derived-initials fallback in OddsBoardPage). Shares getTeamColors' query
 * cache entry with useTeamColors - both read the same /public/team-colors
 * response, so this never triggers a second network request.
 */
export function useTeamAcronyms(): Map<string, string> {
  const { data } = useQuery({ queryKey: ['team-colors'], queryFn: getTeamColors, staleTime: 5 * 60_000 });

  return useMemo(() => {
    const acronymByTeam = new Map<string, string>();
    for (const entry of data ?? []) {
      if (entry.acronym) acronymByTeam.set(entry.name, entry.acronym);
    }
    return acronymByTeam;
  }, [data]);
}
