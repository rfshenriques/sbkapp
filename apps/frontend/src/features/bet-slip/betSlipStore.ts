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

export const DEFAULT_STAKE = '10.00';

export function selectionKey(selection: Pick<BetSlipSelection, 'matchId' | 'marketId'>): string {
  return `${selection.matchId}-${selection.marketId}`;
}

interface BetSlipState {
  selections: BetSlipSelection[];
  addSelection: (selection: BetSlipSelection) => void;
  removeSelection: (matchId: string, marketId: string) => void;
  /** Adds the selection, replacing any existing pick in the same market; removes it if already selected. */
  toggleSelection: (selection: BetSlipSelection) => void;
  clear: () => void;
  /**
   * The accumulator tab's stake and each singles row's own stake (keyed by
   * selectionKey), lifted out of BetSlipPanel's local state so AppShell's
   * collapsed mobile floating pill can preview campaign qualification
   * without the panel itself being mounted.
   */
  stake: string;
  setStake: (value: string) => void;
  singleStakes: Record<string, string>;
  setSingleStake: (selection: BetSlipSelection, value: string) => void;
  /** Applies a price the pre-placement odds re-check (see oddsRecheck.ts) found had moved - the slip always shows the price that will actually be bet at, whether that update was auto-accepted or the player is being asked to review it. */
  updateSelectionOdds: (matchId: string, marketId: string, odds: number) => void;
}

export const useBetSlipStore = create<BetSlipState>((set, get) => ({
  selections: [],
  stake: DEFAULT_STAKE,
  singleStakes: {},

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

  setStake: (value) => set({ stake: value }),
  setSingleStake: (selection, value) =>
    set((state) => ({ singleStakes: { ...state.singleStakes, [selectionKey(selection)]: value } })),

  updateSelectionOdds: (matchId, marketId, odds) =>
    set((state) => ({
      selections: state.selections.map((existing) =>
        existing.matchId === matchId && existing.marketId === marketId ? { ...existing, odds } : existing,
      ),
    })),
}));

/** Falls back to DEFAULT_STAKE for a selection that hasn't had its own stake typed yet. */
export function getSingleStake(singleStakes: Record<string, string>, selection: BetSlipSelection): string {
  return singleStakes[selectionKey(selection)] ?? DEFAULT_STAKE;
}
