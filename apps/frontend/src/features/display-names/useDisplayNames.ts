import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDisplayNameOverrides, type DisplayNameEntityType } from '../../lib/backendApi';

function overrideKey(entityType: DisplayNameEntityType, rawName: string) {
  return `${entityType}:${rawName}`;
}

/**
 * Returns a `displayName(entityType, rawName)` function that swaps in a
 * backoffice-assigned nicer label (e.g. "UEFA Champions League Qualification"
 * -> "UEFA Champions League (Q)") when one is set, falling back to the raw
 * feed name otherwise - never fabricated, only ever what an admin actually
 * set (see the backoffice Display Names page).
 */
export function useDisplayNames() {
  const { data } = useQuery({
    queryKey: ['display-name-overrides'],
    queryFn: getDisplayNameOverrides,
    staleTime: 5 * 60_000,
  });

  const overrideByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const override of data ?? []) {
      map.set(overrideKey(override.entityType, override.rawName), override.displayName);
    }
    return map;
  }, [data]);

  return useCallback(
    (entityType: DisplayNameEntityType, rawName: string) =>
      overrideByKey.get(overrideKey(entityType, rawName)) ?? rawName,
    [overrideByKey],
  );
}
