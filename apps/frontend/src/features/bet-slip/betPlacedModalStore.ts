import { create } from 'zustand';

export interface PlacedBetSummary {
  stakeCents: number;
  potentialPayoutCents: number;
  /** Null when this placement was several independent single bets at once - there's no one combined price to show for those, see BetPlacedModal. */
  combinedOdds: number | null;
  betCount: number;
}

interface BetPlacedModalState {
  summary: PlacedBetSummary | null;
  open: (summary: PlacedBetSummary) => void;
  close: () => void;
}

/**
 * Fired right after a successful placement (see BetSlipPanel's two mutation
 * onSuccess handlers) - holds the just-placed bet's own numbers directly
 * rather than looking one up by id from useBets(), since the cache
 * invalidation that follows placement is async and the modal needs to open
 * immediately with numbers that are already in hand from the placeBet
 * response.
 */
export const useBetPlacedModalStore = create<BetPlacedModalState>((set) => ({
  summary: null,
  open: (summary) => set({ summary }),
  close: () => set({ summary: null }),
}));
