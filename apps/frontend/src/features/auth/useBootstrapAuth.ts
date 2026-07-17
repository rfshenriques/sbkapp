import { useEffect } from 'react';
import * as backendApi from '../../lib/backendApi';
import { useAuthStore } from './authStore';

/**
 * Runs once on app mount: tries to silently mint a fresh access token from
 * the httpOnly refresh cookie, so a page reload doesn't force a re-login as
 * long as the underlying session is still valid. The access token itself is
 * never persisted client-side - this is what re-derives it.
 */
export function useBootstrapAuth() {
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const setAuth = useAuthStore((state) => state.setAuth);
  const setInitialized = useAuthStore((state) => state.setInitialized);

  useEffect(() => {
    if (isInitialized) {
      return;
    }

    let cancelled = false;
    void backendApi.refreshAccessToken().then((result) => {
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
