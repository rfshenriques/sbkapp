import { create } from 'zustand';

interface BrandState {
  /** The resolved brand's id, once useBrandTheme's fetch completes - see getPublicBrand. */
  brandId: string | undefined;
  setBrandId: (brandId: string | undefined) => void;
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
}));
