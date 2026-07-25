import { create } from 'zustand';

interface PasskeyEnrollmentModalState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

/** The "Enable Face ID/Touch ID for faster sign-in?" prompt shown after a password login/register - see runPostLoginPasskeyPrompt.ts for when it fires. */
export const usePasskeyEnrollmentModalStore = create<PasskeyEnrollmentModalState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
