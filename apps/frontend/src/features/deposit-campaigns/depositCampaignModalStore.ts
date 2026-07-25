import { create } from 'zustand';
import type { DepositCampaign } from '../../lib/backendApi';

interface DepositCampaignModalState {
  campaign: DepositCampaign | null;
  open: (campaign: DepositCampaign) => void;
  close: () => void;
}

/**
 * Renders as an AppShell-level overlay, same pattern as authModalStore - see
 * LoginPage.tsx (post-login trigger) and PromoCardTile (click-through for a
 * deposit-linked card) for the two places that call open().
 */
export const useDepositCampaignModalStore = create<DepositCampaignModalState>((set) => ({
  campaign: null,
  open: (campaign) => set({ campaign }),
  close: () => set({ campaign: null }),
}));
