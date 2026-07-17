import { create } from 'zustand';

export interface AuthUser {
  sub: string;
  username: string;
  email: string;
}

interface AuthState {
  /** In-memory only, never persisted - a page reload re-derives this via silent refresh. */
  accessToken: string | null;
  user: AuthUser | null;
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

function decodeAccessToken(accessToken: string): AuthUser | null {
  try {
    const payloadSegment = accessToken.split('.')[1];
    if (!payloadSegment) {
      return null;
    }
    const payload = JSON.parse(base64UrlDecode(payloadSegment)) as Partial<AuthUser>;
    if (!payload.sub || !payload.username || !payload.email) {
      return null;
    }
    return { sub: payload.sub, username: payload.username, email: payload.email };
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  isInitialized: false,

  setAuth: (accessToken) => set({ accessToken, user: decodeAccessToken(accessToken) }),
  clearAuth: () => set({ accessToken: null, user: null }),
  setInitialized: () => set({ isInitialized: true }),
}));
