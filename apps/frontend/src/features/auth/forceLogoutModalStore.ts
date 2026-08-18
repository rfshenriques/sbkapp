import { create } from 'zustand';

interface ForceLogoutModalState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

/** Shown only for a logout the player didn't click themselves (idle timeout, tab backgrounded) - see useForceLogout. A manual "Log out" click never opens this; the login screen appearing is confirmation enough there. */
export const useForceLogoutModalStore = create<ForceLogoutModalState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
