import { useEffect, useState } from 'react';

/** ITU-R BT.601 perceived brightness - good enough for a UI contrast pick, not color-science-accurate. */
function isLightColor(hex: string): boolean {
  const clean = hex.trim().replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((char) => char + char).join('') : clean;
  if (full.length < 6) return false;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some((value) => Number.isNaN(value))) return false;
  return (r * 299 + g * 587 + b * 114) / 1000 > 200;
}

/**
 * Reads a brand-driven CSS custom property (set at runtime on the root
 * element by useBrandTheme) and returns whichever of black/white actually
 * reads legibly against it - a brand can set e.g. --color-highlight to
 * anything, including a pale color a fixed white ring/text would
 * disappear into. Re-checks whenever the root element's inline style
 * changes (that's how useBrandTheme applies a brand's colors), so it's
 * still correct if the brand data arrives after this hook's first render.
 */
export function useContrastColor(cssVariable: string): 'black' | 'white' {
  const [color, setColor] = useState<'black' | 'white'>('white');

  useEffect(() => {
    function compute() {
      const value = getComputedStyle(document.documentElement).getPropertyValue(cssVariable);
      setColor(isLightColor(value) ? 'black' : 'white');
    }
    compute();
    const observer = new MutationObserver(compute);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    return () => observer.disconnect();
  }, [cssVariable]);

  return color;
}
