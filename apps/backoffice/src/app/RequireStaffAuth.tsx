import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useStaffAuth } from '../features/auth/useStaffAuth';

/** Waits for the silent-refresh bootstrap to settle before deciding whether to redirect, to avoid a flash-redirect on every reload. */
export function RequireStaffAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isInitialized } = useStaffAuth();

  if (!isInitialized) {
    return null;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
