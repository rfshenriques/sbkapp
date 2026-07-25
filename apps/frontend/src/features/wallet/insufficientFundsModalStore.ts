import { create } from 'zustand';

interface InsufficientFundsModalState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

/**
 * Mounted at the AppShell level (see insufficientFundsModalStore usage in
 * AppShell.tsx), not inside BetSlipPanel itself - BetSlipPanel can be
 * nested inside the mobile bet slip's own animated BottomSheet, whose
 * transform creates a new containing block that would clip a `fixed`
 * overlay rendered from inside it to that sheet's own bounds instead of
 * the full viewport.
 */
export const useInsufficientFundsModalStore = create<InsufficientFundsModalState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
