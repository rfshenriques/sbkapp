import { useEffect, useState } from 'react';

/** Reactively tracks a CSS media query in JS, for the rare case a component needs to pick between two different subtrees rather than just hiding one with a Tailwind breakpoint class (which would render - and duplicate accessible roles/text for - both). jsdom has no matchMedia, so this defaults to false outside a real browser. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mediaQueryList = window.matchMedia(query);
    const listener = () => setMatches(mediaQueryList.matches);
    listener();
    mediaQueryList.addEventListener('change', listener);
    return () => mediaQueryList.removeEventListener('change', listener);
  }, [query]);

  return matches;
}
