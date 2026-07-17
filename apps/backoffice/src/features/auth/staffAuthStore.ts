import { create } from 'zustand';

export type StaffRole = 'ADMIN' | 'TRADING' | 'RISK' | 'CRM' | 'FRAUD' | 'CMS';

export interface StaffAuthUser {
  sub: string;
  username: string;
  role: StaffRole;
}

interface StaffAuthState {
  /** In-memory only, never persisted - a page reload re-derives this via silent refresh. */
  accessToken: string | null;
  user: StaffAuthUser | null;
  isInitialized: boolean;
  setAuth: (accessToken: string) => void;
  clearAuth: () => void;
  setInitialized: () => void;
}

function base64UrlDecode(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  return atob(padded);
}

function decodeAccessToken(accessToken: string): StaffAuthUser | null {
  try {
    const payloadSegment = accessToken.split('.')[1];
    if (!payloadSegment) {
      return null;
    }
    const payload = JSON.parse(base64UrlDecode(payloadSegment)) as Partial<StaffAuthUser>;
    if (!payload.sub || !payload.username || !payload.role) {
      return null;
    }
    return { sub: payload.sub, username: payload.username, role: payload.role };
  } catch {
    return null;
  }
}

export const useStaffAuthStore = create<StaffAuthState>((set) => ({
  accessToken: null,
  user: null,
  isInitialized: false,

  setAuth: (accessToken) => set({ accessToken, user: decodeAccessToken(accessToken) }),
  clearAuth: () => set({ accessToken: null, user: null }),
  setInitialized: () => set({ isInitialized: true }),
}));
