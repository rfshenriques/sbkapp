import { useEffect, useRef, useState } from 'react';

const FLASH_DURATION_MS = 1000;

/**
 * Tracks a single selection's odds across re-renders (driven by useMatches'
 * poll - see its refetchInterval) and returns 'up'/'down' for one second
 * right after the value actually changes, null otherwise. Compares against
 * the previous render's value via a ref rather than the initial value, so
 * it flashes on every change, not just the first one.
 */
export function useOddsFlash(odds: number): 'up' | 'down' | null {
  const previousOddsRef = useRef(odds);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    const previous = previousOddsRef.current;
    if (odds === previous) {
      return;
    }
    previousOddsRef.current = odds;
    setFlash(odds > previous ? 'up' : 'down');

    const timeout = setTimeout(() => setFlash(null), FLASH_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [odds]);

  return flash;
}
