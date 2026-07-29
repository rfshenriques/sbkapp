import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getPublicBrand } from '../../lib/backendApi';
import { useThemePreferenceStore } from '../theme/themePreferenceStore';
import { useBrandStore } from './brandStore';

/**
 * Fetches this deployment's brand - resolved from the current hostname, see
 * getPublicBrand - and applies its theme - appearance (light/dark) plus the
 * three brand colors - as CSS custom properties on the document root. Falls
 * back to the built-in dark theme and default colors (see index.css) when
 * there's no brand configured or the fetch fails, rather than blocking
 * rendering on it.
 *
 * A player's own light/dark choice (see the account Settings page) wins
 * over the brand's configured themeMode whenever one is set - the brand
 * default only applies until a player picks for themselves.
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

    document.documentElement.dataset.theme = themePreference ?? (brand.themeMode === 'LIGHT' ? 'light' : 'dark');
    if (brand.buttonColorHex) {
      document.documentElement.style.setProperty('--color-brand', brand.buttonColorHex);
    }
    if (brand.highlightColorHex) {
      document.documentElement.style.setProperty('--color-highlight', brand.highlightColorHex);
    }
    if (brand.filterColorHex) {
      document.documentElement.style.setProperty('--color-filter', brand.filterColorHex);
    }
    if (brand.name) {
      document.title = brand.name;
    }
  }, [query.data, themePreference]);

  return query;
}
