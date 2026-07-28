import { create } from 'zustand';

interface BetSlipSheetState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

/**
 * The mobile bet slip's open/closed state - lifted out of AppShell's own
 * local state (it used to be a plain useState there) into a store, the same
 * pattern every other overlay in this app already uses (see
 * depositModalStore, authModalStore, ...), so a flow outside AppShell can
 * open the sheet programmatically. Added for SharedBetPage: once a deep
 * link's selections are added to the slip, the sheet should just open
 * showing them rather than a separate "N selections added" confirmation
 * screen. Desktop's bet slip is a persistent panel, not this sheet - opening
 * it there is harmless but has no visible effect.
 */
export const useBetSlipSheetStore = create<BetSlipSheetState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
