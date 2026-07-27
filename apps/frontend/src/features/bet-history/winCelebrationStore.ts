import { create } from 'zustand';

interface WinCelebrationState {
  betId: string | null;
  open: (betId: string) => void;
  close: () => void;
}

/** Renders as an AppShell-level overlay, same pattern as betDetailModalStore - see useWinCelebrationDetector for what opens it. */
export const useWinCelebrationStore = create<WinCelebrationState>((set) => ({
  betId: null,
  open: (betId) => set({ betId }),
  close: () => set({ betId: null }),
}));
