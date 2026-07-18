import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useStaffAuthStore } from '../features/auth/staffAuthStore';
import { RequireAdminRole } from './RequireAdminRole';

function renderGuarded() {
  return render(
    <RequireAdminRole>
      <div>Staff user management</div>
    </RequireAdminRole>,
  );
}

describe('RequireAdminRole', () => {
  it('renders the protected content for an ADMIN staff member', () => {
    useStaffAuthStore.setState({
      accessToken: 'header.payload.signature',
      user: { sub: 'staff-1', username: 'admin_amy', role: 'ADMIN' },
      isInitialized: true,
    });
    renderGuarded();

    expect(screen.getByText('Staff user management')).toBeInTheDocument();
  });

  it('blocks a non-ADMIN staff member with a message instead of the content', () => {
    useStaffAuthStore.setState({
      accessToken: 'header.payload.signature',
      user: { sub: 'staff-2', username: 'trader_bob', role: 'TRADING' },
      isInitialized: true,
    });
    renderGuarded();

    expect(screen.queryByText('Staff user management')).not.toBeInTheDocument();
    expect(screen.getByText(/Only ADMIN staff/)).toBeInTheDocument();
  });
});
