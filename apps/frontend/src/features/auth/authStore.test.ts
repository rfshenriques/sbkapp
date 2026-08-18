import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from './authStore';

const SESSION_STARTED_AT_STORAGE_KEY = 'sportsbook_session_started_at';

function fakeToken(payload: Record<string, unknown>): string {
  const base64url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${base64url({ alg: 'none' })}.${base64url(payload)}.sig`;
}

beforeEach(() => {
  localStorage.clear();
  useAuthStore.setState({ accessToken: null, user: null, sessionStartedAt: null, isInitialized: false });
});

afterEach(() => {
  localStorage.clear();
});

describe('authStore session timer', () => {
  it('stamps sessionStartedAt on the first setAuth and persists it to localStorage', () => {
    const before = Date.now();
    useAuthStore.getState().setAuth(fakeToken({ sub: 'p1', username: 'alice', email: 'a@example.com' }));
    const after = Date.now();

    const started = useAuthStore.getState().sessionStartedAt;
    expect(started).not.toBeNull();
    expect(started!).toBeGreaterThanOrEqual(before);
    expect(started!).toBeLessThanOrEqual(after);
    expect(Number(localStorage.getItem(SESSION_STARTED_AT_STORAGE_KEY))).toBe(started);
  });

  it('keeps the same sessionStartedAt across a token refresh (does not reset the timer)', async () => {
    useAuthStore.getState().setAuth(fakeToken({ sub: 'p1', username: 'alice', email: 'a@example.com' }));
    const firstStarted = useAuthStore.getState().sessionStartedAt;

    await new Promise((resolve) => setTimeout(resolve, 5));
    useAuthStore.getState().setAuth(fakeToken({ sub: 'p1', username: 'alice', email: 'a@example.com' }));

    expect(useAuthStore.getState().sessionStartedAt).toBe(firstStarted);
  });

  it('restores sessionStartedAt from localStorage on a fresh store (simulating a page reload mid-session)', () => {
    const persisted = Date.now() - 60_000;
    localStorage.setItem(SESSION_STARTED_AT_STORAGE_KEY, String(persisted));

    useAuthStore.getState().setAuth(fakeToken({ sub: 'p1', username: 'alice', email: 'a@example.com' }));

    expect(useAuthStore.getState().sessionStartedAt).toBe(persisted);
  });

  it('clears sessionStartedAt (and localStorage) on logout', () => {
    useAuthStore.getState().setAuth(fakeToken({ sub: 'p1', username: 'alice', email: 'a@example.com' }));
    expect(useAuthStore.getState().sessionStartedAt).not.toBeNull();

    useAuthStore.getState().clearAuth();

    expect(useAuthStore.getState().sessionStartedAt).toBeNull();
    expect(localStorage.getItem(SESSION_STARTED_AT_STORAGE_KEY)).toBeNull();
  });
});
