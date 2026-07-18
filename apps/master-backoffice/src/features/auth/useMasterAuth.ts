import { useCallback } from 'react';
import * as backendApi from '../../lib/backendApi';
import { useMasterAuthStore } from './masterAuthStore';

export function useMasterAuth() {
  const accessToken = useMasterAuthStore((state) => state.accessToken);
  const user = useMasterAuthStore((state) => state.user);
  const isInitialized = useMasterAuthStore((state) => state.isInitialized);
  const setAuth = useMasterAuthStore((state) => state.setAuth);
  const clearAuth = useMasterAuthStore((state) => state.clearAuth);

  const login = useCallback(
    async (identifier: string, password: string) => {
      const { accessToken } = await backendApi.masterLogin({ identifier, password });
      setAuth(accessToken);
    },
    [setAuth],
  );

  const logout = useCallback(async () => {
    await backendApi.masterLogout();
    clearAuth();
  }, [clearAuth]);

  return {
    accessToken,
    user,
    isInitialized,
    isAuthenticated: Boolean(accessToken),
    login,
    logout,
  };
}
