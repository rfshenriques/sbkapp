import { create } from 'zustand';

export interface BetSlipSelection {
  matchId: string;
  marketId: string;
  selectionId: string;
  matchLabel: string;
  marketName: string;
  selectionName: string;
  odds: number;
  /** Present only when a trader-configured boost bumped this selection's price - the price it would otherwise show, for the "before/after" display. */
  originalOdds?: number;
  /** Present only alongside originalOdds when the boost has a per-bet stake cap - shown so the player knows the boosted price only applies up to this stake. In cents. */
  maxStakeCents?: number;
  /** True only when this selection's market was flagged singlesOnly by a trader (see Market.singlesOnly) - PamService rejects combining it into any 2+-selection accumulator. */
  marketSinglesOnly?: boolean;
}

interface BetSlipState {
  selections: BetSlipSelection[];
  addSelection: (selection: BetSlipSelection) => void;
  removeSelection: (matchId: string, marketId: string) => void;
  /** Adds the selection, replacing any existing pick in the same market; removes it if already selected. */
  toggleSelection: (selection: BetSlipSelection) => void;
  clear: () => void;
}

export const useBetSlipStore = create<BetSlipState>((set, get) => ({
  selections: [],

  addSelection: (selection) =>
    set((state) => ({
      selections: [
        ...state.selections.filter(
          (existing) =>
            !(existing.matchId === selection.matchId && existing.marketId === selection.marketId),
        ),
        selection,
      ],
    })),

  removeSelection: (matchId, marketId) =>
    set((state) => ({
      selections: state.selections.filter(
        (existing) => !(existing.matchId === matchId && existing.marketId === marketId),
      ),
    })),

  toggleSelection: (selection) => {
    const existing = get().selections.find(
      (candidate) =>
        candidate.matchId === selection.matchId && candidate.marketId === selection.marketId,
    );
    if (existing && existing.selectionId === selection.selectionId) {
      get().removeSelection(selection.matchId, selection.marketId);
    } else {
      get().addSelection(selection);
    }
  },

  clear: () => set({ selections: [] }),
}));
