import { create } from 'zustand';

export interface BetSlipSelection {
  matchId: string;
  marketId: string;
  selectionId: string;
  matchLabel: string;
  marketName: string;
  selectionName: string;
  odds: number;
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
