import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTeamColors } from '../../lib/backendApi';

/** name -> colorHex, for teams an admin has assigned a real color to. Teams with no color set simply aren't in the map - callers must not fabricate one. */
export function useTeamColors(): Map<string, string> {
  const { data } = useQuery({ queryKey: ['team-colors'], queryFn: getTeamColors, staleTime: 5 * 60_000 });

  return useMemo(() => {
    const colorByTeam = new Map<string, string>();
    for (const entry of data ?? []) {
      if (entry.colorHex) colorByTeam.set(entry.name, entry.colorHex);
    }
    return colorByTeam;
  }, [data]);
}
