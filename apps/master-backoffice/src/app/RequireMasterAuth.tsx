import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useMasterAuth } from '../features/auth/useMasterAuth';

/** Waits for the silent-refresh bootstrap to settle before deciding whether to redirect, to avoid a flash-redirect on every reload. */
export function RequireMasterAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isInitialized } = useMasterAuth();

  if (!isInitialized) {
    return null;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
