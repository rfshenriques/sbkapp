import { useEffect } from 'react';
import * as backendApi from '../../lib/backendApi';
import { useMasterAuthStore } from './masterAuthStore';

/**
 * Runs once on app mount: tries to silently mint a fresh access token from
 * the httpOnly master refresh cookie, so a page reload doesn't force a
 * re-login as long as the underlying session is still valid.
 */
export function useBootstrapMasterAuth() {
  const isInitialized = useMasterAuthStore((state) => state.isInitialized);
  const setAuth = useMasterAuthStore((state) => state.setAuth);
  const setInitialized = useMasterAuthStore((state) => state.setInitialized);

  useEffect(() => {
    if (isInitialized) {
      return;
    }

    let cancelled = false;
    void backendApi.refreshMasterAccessToken().then((result) => {
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
