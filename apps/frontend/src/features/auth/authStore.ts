import { create } from 'zustand';

export interface AuthUser {
  sub: string;
  username: string;
  email: string;
}

/** Persisted (unlike accessToken) so the footer's session timer survives a page reload instead of resetting to 0 mid-session - see setAuth. */
const SESSION_STARTED_AT_STORAGE_KEY = 'sportsbook_session_started_at';

interface AuthState {
  /** In-memory only, never persisted - a page reload re-derives this via silent refresh. */
  accessToken: string | null;
  user: AuthUser | null;
  isInitialized: boolean;
  /** When the current continuous login began (see the footer's session timer) - epoch ms, or null when logged out. Set once per login and left alone across a silent refresh-on-reload, so it reflects real elapsed session time rather than resetting on every page load. */
  sessionStartedAt: number | null;
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

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  user: null,
  isInitialized: false,
  sessionStartedAt: null,

  setAuth: (accessToken) => {
    let sessionStartedAt = get().sessionStartedAt;
    if (sessionStartedAt === null) {
      const stored = Number(localStorage.getItem(SESSION_STARTED_AT_STORAGE_KEY));
      if (Number.isFinite(stored) && stored > 0) {
        sessionStartedAt = stored;
      } else {
        sessionStartedAt = Date.now();
        localStorage.setItem(SESSION_STARTED_AT_STORAGE_KEY, String(sessionStartedAt));
      }
    }
    set({ accessToken, user: decodeAccessToken(accessToken), sessionStartedAt });
  },
  clearAuth: () => {
    localStorage.removeItem(SESSION_STARTED_AT_STORAGE_KEY);
    set({ accessToken: null, user: null, sessionStartedAt: null });
  },
  setInitialized: () => set({ isInitialized: true }),
}));
