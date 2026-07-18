import type { ReactNode } from 'react';
import { useStaffAuth } from '../features/auth/useStaffAuth';

/** Assumes it's rendered inside RequireStaffAuth, so a session is already confirmed present. */
export function RequireAdminRole({ children }: { children: ReactNode }) {
  const { user } = useStaffAuth();

  if (user?.role !== 'ADMIN') {
    return <p className="text-sm text-danger">Only ADMIN staff can manage staff users.</p>;
  }
  return children;
}
