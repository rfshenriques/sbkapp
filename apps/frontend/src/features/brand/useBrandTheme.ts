import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getPublicBrand, type ColorValue, type ColorZone, type GradientDirection } from '../../lib/backendApi';
import { useThemePreferenceStore } from '../theme/themePreferenceStore';
import { useBrandStore } from './brandStore';

const CSS_GRADIENT_DIRECTION: Record<GradientDirection, string> = {
  'to-t': 'to top',
  'to-b': 'to bottom',
  'to-l': 'to left',
  'to-r': 'to right',
  'to-tl': 'to top left',
  'to-tr': 'to top right',
  'to-bl': 'to bottom left',
  'to-br': 'to bottom right',
};

/**
 * Pushes one zone's resolved value onto its CSS custom properties -
 * `--color-{name}` always ends up a plain hex (the gradient's own "from"
 * stop when it's a gradient) so every existing consumer that just reads a
 * flat color still works unchanged. `--gradient-{name}` is left *unset*
 * for a solid color - not set to a literal "none", which would defeat the
 * CSS `var(--gradient-{name}, <fallback>)` fallback pattern index.css uses
 * on .btn-primary/.odd-btn.selected/.tab.active/.tab-pill-btn.active (an
 * explicit "none" always wins over a var() fallback; only a genuinely
 * unset property falls through to it) - only set to a real
 * `linear-gradient(...)` when the brand actually configured a gradient.
 */
function applyColorValue(name: string, value: ColorValue | undefined): void {
  const root = document.documentElement.style;
  if (!value) {
    root.removeProperty(`--color-${name}`);
    root.removeProperty(`--gradient-${name}`);
    return;
  }
  if (value.type === 'solid') {
    root.setProperty(`--color-${name}`, value.hex);
    root.removeProperty(`--gradient-${name}`);
    return;
  }
  root.setProperty(`--color-${name}`, value.fromHex);
  root.setProperty(
    `--gradient-${name}`,
    `linear-gradient(${CSS_GRADIENT_DIRECTION[value.direction]}, ${value.fromHex}, ${value.toHex})`,
  );
}

function applyColorZone(name: string, zone: ColorZone | null | undefined, activeTheme: 'light' | 'dark'): void {
  applyColorValue(name, zone?.[activeTheme]);
}

/**
 * Fetches this deployment's brand - resolved from the current hostname, see
 * getPublicBrand - and applies its theme (light/dark logo + background/
 * button/highlight/filter/text colors, each independently solid or
 * gradient - see brand-color.ts on the backend) as CSS custom properties on
 * the document root. Falls back to the built-in dark theme and default
 * colors (see index.css) when there's no brand configured or the fetch
 * fails, rather than blocking rendering on it.
 *
 * A player's own light/dark choice (see the account Settings page) wins
 * over the brand's configured themeMode whenever one is set - the brand
 * default only applies until a player picks for themselves, and every
 * light/dark pair (logos, colors) is always fully configured regardless of
 * which one is currently active, so toggling never loses the other's setup.
 */
export function useBrandTheme() {
  const query = useQuery({
    queryKey: ['public-brand', typeof window === 'undefined' ? '' : window.location.hostname],
    queryFn: getPublicBrand,
    staleTime: Infinity,
  });
  const themePreference = useThemePreferenceStore((state) => state.preference);

  useEffect(() => {
    const brand = query.data;
    useBrandStore.getState().setBrandId(brand?.id);
    if (!brand) return;

    const activeTheme: 'light' | 'dark' = themePreference ?? (brand.themeMode === 'LIGHT' ? 'light' : 'dark');
    document.documentElement.dataset.theme = activeTheme;

    applyColorZone('background', brand.backgroundColor, activeTheme);
    applyColorZone('brand', brand.buttonColor, activeTheme);
    applyColorZone('highlight', brand.highlightColor, activeTheme);
    applyColorZone('filter', brand.filterColor, activeTheme);
    applyColorZone('text-primary', brand.textColor, activeTheme);

    const logoUrl =
      activeTheme === 'light'
        ? (brand.logoLightUrl ?? brand.logoDarkUrl)
        : (brand.logoDarkUrl ?? brand.logoLightUrl);
    const shareLogoUrl =
      activeTheme === 'light'
        ? (brand.shareLogoLightUrl ?? brand.shareLogoDarkUrl)
        : (brand.shareLogoDarkUrl ?? brand.shareLogoLightUrl);
    useBrandStore.getState().setLogoUrls(logoUrl, shareLogoUrl);

    if (brand.name) {
      document.title = brand.name;
    }
  }, [query.data, themePreference]);

  return query;
}
