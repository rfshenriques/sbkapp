import { useEffect, useRef } from 'react';
import { logoutBeacon } from '../../lib/backendApi';
import { useAuthStore } from './authStore';
import { useAuth } from './useAuth';

const IDLE_TIMEOUT_MS = 5 * 60_000;
/** Anything that counts as "the player is still using the app" - resets the idle timer. */
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'wheel', 'scroll'] as const;

/**
 * A gambling app's session shouldn't outlive the player actually being in
 * it: logs the player out (revoking the refresh token server-side, not just
 * clearing local state) the instant the app is backgrounded or the tab/app
 * is closed, and also after 5 minutes with no touch/click/key/scroll while
 * it stays in the foreground. Runs once at the AppShell level, mirroring
 * useBootstrapAuth/useWinCelebrationDetector's "one hook, always mounted"
 * pattern. A revoked session is otherwise indistinguishable from any other
 * expired one - the next authenticatedFetch's silent refresh simply fails
 * and clearAuth() runs, same path task #291's other-device revocation
 * already relies on.
 */
export function useForceLogout() {
  const { isAuthenticated, logout } = useAuth();
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    function resetIdleTimer() {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        void logout();
      }, IDLE_TIMEOUT_MS);
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        void logout();
      }
    }

    // pagehide (not beforeunload/unload) fires reliably on both a real tab
    // close and an iOS/Android PWA being swiped away, and still fires when
    // the page is about to enter the bfcache - a plain fetch() started here
    // can be aborted before it reaches the network, so this uses sendBeacon
    // instead. Nothing to await: by the time this returns the tab may
    // already be gone, so the store is cleared optimistically alongside it.
    function handlePageHide() {
      logoutBeacon();
      useAuthStore.getState().clearAuth();
    }

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, resetIdleTimer, { passive: true });
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    resetIdleTimer();

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, resetIdleTimer);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [isAuthenticated, logout]);
}
