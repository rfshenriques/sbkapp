import type { ReactNode } from 'react';
import { useStaffAuth } from '../features/auth/useStaffAuth';
import type { StaffRole } from '../lib/backendApi';

interface RequireRolesProps {
  roles: StaffRole[];
  children: ReactNode;
}

/** Assumes it's rendered inside RequireStaffAuth, so a session is already confirmed present. */
export function RequireRoles({ roles, children }: RequireRolesProps) {
  const { user } = useStaffAuth();

  if (!user || !roles.includes(user.role)) {
    return (
      <p className="text-sm text-danger">Only {roles.join('/')} staff can access this page.</p>
    );
  }
  return children;
}
