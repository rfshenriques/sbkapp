import { create } from 'zustand';

/** Starter amounts (major currency unit, e.g. euros) until a player's own server-stored ones load - the same 4-slot shape either way. */
export const DEFAULT_QUICK_STAKES = [5, 10, 25, 50];

interface BetSlipSettingsState {
  /** Whether a price change discovered by the pre-placement odds re-check (see useOddsRecheck) is accepted automatically, or blocks placement with an alert instead. Off by default - silently placing at a different price than what the player saw is opt-in, not assumed. */
  autoUpdateOdds: boolean;
  setAutoUpdateOdds: (value: boolean) => void;
  /** 4 player-chosen amounts, shown as quick-fill buttons on every stake field. */
  quickStakes: number[];
  setQuickStakes: (stakes: number[]) => void;
}

/**
 * Bet slip preferences (see BetSlipSettingsPanel, opened via the gear icon
 * in BetSlipPanel) - plain in-memory state here; useBetSlipSettings owns
 * loading it from the backend on login, saving changes back, and resetting
 * it to these defaults on logout. Guests never read or write anything
 * other than these defaults (see BetSlipPanel gating the settings UI on
 * isAuthenticated) - there's nowhere for a guest's changes to persist to.
 */
export const useBetSlipSettingsStore = create<BetSlipSettingsState>((set) => ({
  autoUpdateOdds: false,
  setAutoUpdateOdds: (value) => set({ autoUpdateOdds: value }),
  quickStakes: DEFAULT_QUICK_STAKES,
  setQuickStakes: (stakes) => set({ quickStakes: stakes }),
}));
