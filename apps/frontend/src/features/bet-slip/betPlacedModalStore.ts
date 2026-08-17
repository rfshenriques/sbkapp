import { create } from 'zustand';
import type { PlacedBet } from '../../lib/backendApi';

export interface PlacedBetSummary {
  stakeCents: number;
  potentialPayoutCents: number;
  /** Null when this placement was several independent single bets at once - there's no one combined price to show for those, see BetPlacedModal. */
  combinedOdds: number | null;
  betCount: number;
  /**
   * Campaign qualification, if any - mirrors PlacedBet's own fields (see
   * backendApi.ts). For a multi-singles placement these are the first
   * qualifying bet of each kind among the batch (see BetSlipPanel's
   * placeSinglesMutation), since different singles could in principle match
   * different campaigns but the confirmation modal only has room for one
   * note per kind.
   */
  betAndGetCampaignName: string | null;
  betAndGetCampaignRewardCents: number | null;
  depositCampaignName: string | null;
  depositCampaignRewardCents: number | null;
  registerCampaignName: string | null;
  registerCampaignRewardCents: number | null;
  /**
   * The full placed bet - only set when this placement produced exactly one
   * bet (a single or an accumulator; never set for a multi-singles batch,
   * which has no single bet to attach). Lets BetPlacedModal show an
   * expandable "Bet details" section and a real image/link share, the same
   * as bet history, instead of just the aggregate numbers above.
   */
  bet?: PlacedBet;
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
