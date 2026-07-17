import { useEffect } from 'react';
import * as backendApi from '../../lib/backendApi';
import { useStaffAuthStore } from './staffAuthStore';

/**
 * Runs once on app mount: tries to silently mint a fresh access token from
 * the httpOnly staff refresh cookie, so a page reload doesn't force a
 * re-login as long as the underlying session is still valid.
 */
export function useBootstrapStaffAuth() {
  const isInitialized = useStaffAuthStore((state) => state.isInitialized);
  const setAuth = useStaffAuthStore((state) => state.setAuth);
  const setInitialized = useStaffAuthStore((state) => state.setInitialized);

  useEffect(() => {
    if (isInitialized) {
      return;
    }

    let cancelled = false;
    void backendApi.refreshStaffAccessToken().then((result) => {
      if (cancelled) {
        return;
      }
      if (result) {
        setAuth(result.accessToken);
      }
      setInitialized();
    });

    return () => {
      cancelled = true;
    };
  }, [isInitialized, setAuth, setInitialized]);
}
