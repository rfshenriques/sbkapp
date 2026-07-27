import { create } from 'zustand';

interface BetDetailModalState {
  betId: string | null;
  open: (betId: string) => void;
  close: () => void;
}

/**
 * Renders as an AppShell-level overlay, same pattern as authModalStore/
 * depositModalStore - the modal itself looks the bet up from useBets()'s
 * already-fetched cache by id, so this store only needs to carry which
 * bet is selected, not the bet data itself.
 */
export const useBetDetailModalStore = create<BetDetailModalState>((set) => ({
  betId: null,
  open: (betId) => set({ betId }),
  close: () => set({ betId: null }),
}));
