import { create } from 'zustand';

interface BrandState {
  /** The resolved brand's id, once useBrandTheme's fetch completes - see getPublicBrand. */
  brandId: string | undefined;
  setBrandId: (brandId: string | undefined) => void;
  /**
   * The brand's site/share logo already resolved to the active theme (light
   * or dark - see useBrandTheme, which is the only writer here). Kept in
   * this store rather than read fresh from the query everywhere, because
   * shareBetImage.ts draws the share logo onto a canvas outside of React and
   * has no other way to know which of the 4 uploaded logo slots applies
   * right now.
   */
  logoUrl: string | null;
  shareLogoUrl: string | null;
  setLogoUrls: (logoUrl: string | null, shareLogoUrl: string | null) => void;
  /** ISO 4217 code (see Brand.currencyCode) - defaults to EUR until useBrandTheme's fetch resolves, matching every deployment's actual currency before this field existed. Read via lib/currency.ts's formatMoney/formatMoneySmart, both inside and outside React. */
  currencyCode: string;
  setCurrencyCode: (currencyCode: string) => void;
}

/**
 * A tiny store rather than just component state because backendApi.register
 * needs to read the resolved brandId outside of React (see PROJECT_BRIEF.md
 * Section 10's domain-based brand resolution notes) - it can't rely on
 * VITE_BRAND_ID alone anymore now that one deployment can serve many
 * brands' domains.
 */
export const useBrandStore = create<BrandState>((set) => ({
  brandId: undefined,
  setBrandId: (brandId) => set({ brandId }),
  logoUrl: null,
  shareLogoUrl: null,
  setLogoUrls: (logoUrl, shareLogoUrl) => set({ logoUrl, shareLogoUrl }),
  currencyCode: 'EUR',
  setCurrencyCode: (currencyCode) => set({ currencyCode }),
}));
