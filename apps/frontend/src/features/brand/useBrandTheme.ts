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
 * Points the desktop browser tab icon and iOS's "Add to Home Screen" mark
 * at the acting brand's own icon, same as document.title below - without
 * this, both fall back to index.html's static generic icon regardless of
 * which brand is actually being served. Prefers the brand's dedicated
 * appIconUrl (a square icon meant for exactly this) over the header logo -
 * a wide rectangular header logo usually reads badly once forced into a
 * small square favicon. iOS reads whatever this link's current href is at
 * the moment a player taps "Add to Home Screen" (not a separately-cached
 * asset), so updating it here is enough for that flow.
 */
function updateFavicon(url: string | null | undefined): void {
  if (!url) return;
  for (const rel of ['icon', 'apple-touch-icon']) {
    let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
    if (!link) {
      link = document.createElement('link');
      link.rel = rel;
      document.head.appendChild(link);
    }
    link.href = url;
  }
}

/**
 * A blob URL, swapped in each time this runs so the previous render's isn't
 * leaked - Android/desktop's "Install app" prompt reads the Web App
 * Manifest's own icons, which stay generic since manifest.webmanifest is
 * one static file for every brand this backend serves. Swapping the
 * <link rel="manifest"> href to a blob built from the brand's appIconUrl at
 * runtime is what actually makes that install icon per-brand too, the same
 * technique other multi-tenant PWAs use since there's no way to serve a
 * dynamic manifest.webmanifest from a static file. Left alone entirely
 * (falls back to the static file's generic icon) when the brand has no
 * dedicated app icon configured.
 */
let manifestBlobUrl: string | null = null;

function updateManifestIcon(iconUrl: string | null | undefined, brandName: string): void {
  if (!iconUrl) return;
  const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (!link) return;

  const manifest = {
    name: brandName || 'Sportsbook',
    short_name: brandName || 'Sportsbook',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0b0f1a',
    theme_color: '#0b0f1a',
    // No fixed "sizes" - staff can upload whatever square image they have,
    // and declaring an exact size that doesn't match the actual image can
    // make some browsers skip the icon entirely.
    icons: [{ src: iconUrl, sizes: 'any' }],
  };
  const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
  const url = URL.createObjectURL(blob);
  if (manifestBlobUrl) URL.revokeObjectURL(manifestBlobUrl);
  manifestBlobUrl = url;
  link.href = url;
}

/**
 * Fetches this deployment's brand - resolved from the current hostname, see
 * getPublicBrand - and applies its theme (light/dark logo + background/
 * surface/button/highlight/filter/text/freebet-badge colors, each
 * independently solid or gradient - see brand-color.ts on the backend) as
 * CSS custom properties on the document root. Falls back to the built-in
 * dark theme and default
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
    applyColorZone('surface', brand.surfaceColor, activeTheme);
    applyColorZone('brand', brand.buttonColor, activeTheme);
    applyColorZone('highlight', brand.highlightColor, activeTheme);
    applyColorZone('filter', brand.filterColor, activeTheme);
    applyColorZone('text-primary', brand.textColor, activeTheme);
    applyColorZone('freebet-badge', brand.freebetBadgeColor, activeTheme);

    const logoUrl =
      activeTheme === 'light'
        ? (brand.logoLightUrl ?? brand.logoDarkUrl)
        : (brand.logoDarkUrl ?? brand.logoLightUrl);
    const shareLogoUrl =
      activeTheme === 'light'
        ? (brand.shareLogoLightUrl ?? brand.shareLogoDarkUrl)
        : (brand.shareLogoDarkUrl ?? brand.shareLogoLightUrl);
    useBrandStore.getState().setLogoUrls(logoUrl, shareLogoUrl);
    useBrandStore.getState().setCurrencyCode(brand.currencyCode);
    useBrandStore.getState().setTimeFormat(brand.timeFormat);
    updateFavicon(brand.appIconUrl ?? logoUrl);
    updateManifestIcon(brand.appIconUrl, brand.name);

    if (brand.name) {
      document.title = brand.name;
    }
  }, [query.data, themePreference]);

  return query;
}
