import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useStaffAuthStore } from '../features/auth/staffAuthStore';
import { RequireRoles } from './RequireRoles';

function renderGuarded(roles: Array<'ADMIN' | 'TRADING'>) {
  return render(
    <RequireRoles roles={roles}>
      <div>Protected content</div>
    </RequireRoles>,
  );
}

describe('RequireRoles', () => {
  it('renders the protected content when the staff member has one of the allowed roles', () => {
    useStaffAuthStore.setState({
      accessToken: 'header.payload.signature',
      user: { sub: 'staff-1', username: 'admin_amy', role: 'ADMIN' },
      isInitialized: true,
    });
    renderGuarded(['ADMIN']);

    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });

  it('allows any role in the list, not just the first', () => {
    useStaffAuthStore.setState({
      accessToken: 'header.payload.signature',
      user: { sub: 'staff-2', username: 'trader_bob', role: 'TRADING' },
      isInitialized: true,
    });
    renderGuarded(['ADMIN', 'TRADING']);

    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });

  it('blocks a staff member whose role is not in the list', () => {
    useStaffAuthStore.setState({
      accessToken: 'header.payload.signature',
      user: { sub: 'staff-3', username: 'crm_carla', role: 'CRM' },
      isInitialized: true,
    });
    renderGuarded(['ADMIN', 'TRADING']);

    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    expect(screen.getByText(/Only ADMIN\/TRADING staff/)).toBeInTheDocument();
  });
});
