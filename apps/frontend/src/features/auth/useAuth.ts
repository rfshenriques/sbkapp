import { useCallback } from 'react';
import * as backendApi from '../../lib/backendApi';
import { useAuthStore } from './authStore';

export function useAuth() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const setAuth = useAuthStore((state) => state.setAuth);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const login = useCallback(
    async (identifier: string, password: string) => {
      const { accessToken } = await backendApi.login({ identifier, password });
      setAuth(accessToken);
    },
    [setAuth],
  );

  const register = useCallback(
    async (payload: backendApi.RegisterPayload) => {
      const { accessToken } = await backendApi.register(payload);
      setAuth(accessToken);
    },
    [setAuth],
  );

  const logout = useCallback(async () => {
    await backendApi.logout();
    clearAuth();
  }, [clearAuth]);

  return {
    accessToken,
    user,
    isInitialized,
    isAuthenticated: Boolean(accessToken),
    login,
    register,
    logout,
  };
}
