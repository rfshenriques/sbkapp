import { create } from 'zustand';

interface FreebetCreditedModalState {
  grantId: string | null;
  open: (grantId: string) => void;
  close: () => void;
}

/** Renders as an AppShell-level overlay, same pattern as winCelebrationStore - stores just the grant id, re-derived from useFreebets() data by the modal itself. See useFreebetGrantDetector for what opens it. */
export const useFreebetCreditedModalStore = create<FreebetCreditedModalState>((set) => ({
  grantId: null,
  open: (grantId) => set({ grantId }),
  close: () => set({ grantId: null }),
}));
