import { create } from 'zustand';

export type AuthModalMode = 'login' | 'register' | null;

interface AuthModalState {
  mode: AuthModalMode;
  open: (mode: 'login' | 'register') => void;
  close: () => void;
}

/**
 * Login/Register render as an overlay AppShell keeps mounted alongside its
 * Outlet, not as routes the router swaps the Outlet's content for - the
 * player's current page (odds board, match detail, whatever) stays mounted
 * and visible (dimmed) behind the modal instead of unmounting into an empty
 * page. See AppShell.tsx and AuthDeepLink.tsx (the /login, /register routes
 * still exist for deep-linking, they just open this store then redirect).
 */
export const useAuthModalStore = create<AuthModalState>((set) => ({
  mode: null,
  open: (mode) => set({ mode }),
  close: () => set({ mode: null }),
}));
