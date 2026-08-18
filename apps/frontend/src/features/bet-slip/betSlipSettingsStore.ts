import { create } from 'zustand';

const AUTO_UPDATE_ODDS_KEY = 'bet-slip-auto-update-odds';
const QUICK_STAKES_KEY = 'bet-slip-quick-stakes';

/** Starter amounts (major currency unit, e.g. euros) until a player sets their own - the same 4-slot shape either way. */
const DEFAULT_QUICK_STAKES = [5, 10, 25, 50];

function readAutoUpdateOdds(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(AUTO_UPDATE_ODDS_KEY) === 'true';
}

function readQuickStakes(): number[] {
  if (typeof window === 'undefined') return DEFAULT_QUICK_STAKES;
  const stored = window.localStorage.getItem(QUICK_STAKES_KEY);
  if (!stored) return DEFAULT_QUICK_STAKES;
  try {
    const parsed: unknown = JSON.parse(stored);
    if (Array.isArray(parsed) && parsed.length === 4 && parsed.every((value) => typeof value === 'number' && value > 0)) {
      return parsed as number[];
    }
  } catch {
    // Corrupt/hand-edited localStorage value - fall through to defaults.
  }
  return DEFAULT_QUICK_STAKES;
}

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
 * in BetSlipPanel) - persisted per-device in localStorage, not tied to the
 * player's account, same pattern as themePreferenceStore. There's no
 * per-user settings model on the backend to hang these off yet; if that
 * changes, this is the one place that would need to start syncing instead
 * of just reading/writing localStorage directly.
 */
export const useBetSlipSettingsStore = create<BetSlipSettingsState>((set) => ({
  autoUpdateOdds: readAutoUpdateOdds(),
  setAutoUpdateOdds: (value) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(AUTO_UPDATE_ODDS_KEY, String(value));
    }
    set({ autoUpdateOdds: value });
  },
  quickStakes: readQuickStakes(),
  setQuickStakes: (stakes) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(QUICK_STAKES_KEY, JSON.stringify(stakes));
    }
    set({ quickStakes: stakes });
  },
}));
