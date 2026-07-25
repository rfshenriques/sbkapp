import { create } from 'zustand';

interface DepositModalState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

/**
 * The generic "add funds" flow - the cash balance "+" button in the header
 * and the bet slip's insufficient-funds prompt both open this, as opposed
 * to useDepositCampaignModalStore which only ever opens for a specific
 * promotion. Renders as an AppShell-level overlay, same pattern as
 * authModalStore/depositCampaignModalStore.
 */
export const useDepositModalStore = create<DepositModalState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
