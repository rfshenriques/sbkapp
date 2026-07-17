import { useCallback } from 'react';
import * as backendApi from '../../lib/backendApi';
import { useStaffAuthStore } from './staffAuthStore';

export function useStaffAuth() {
  const accessToken = useStaffAuthStore((state) => state.accessToken);
  const user = useStaffAuthStore((state) => state.user);
  const isInitialized = useStaffAuthStore((state) => state.isInitialized);
  const setAuth = useStaffAuthStore((state) => state.setAuth);
  const clearAuth = useStaffAuthStore((state) => state.clearAuth);

  const login = useCallback(
    async (identifier: string, password: string) => {
      const { accessToken } = await backendApi.staffLogin({ identifier, password });
      setAuth(accessToken);
    },
    [setAuth],
  );

  const logout = useCallback(async () => {
    await backendApi.staffLogout();
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
