import { create } from 'zustand';

export type ThemePreference = 'light' | 'dark' | null;

const STORAGE_KEY = 'theme-preference';

function readStoredPreference(): ThemePreference {
  if (typeof window === 'undefined') return null;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : null;
}

interface ThemePreferenceState {
  /** null = follow the brand's own themeMode (see useBrandTheme). Persisted
   * per-device in localStorage, not tied to the player's account - the same
   * browser keeps the same look across logins/logouts. */
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

export const useThemePreferenceStore = create<ThemePreferenceState>((set) => ({
  preference: readStoredPreference(),
  setPreference: (preference) => {
    if (typeof window !== 'undefined') {
      if (preference) {
        window.localStorage.setItem(STORAGE_KEY, preference);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    set({ preference });
  },
}));
