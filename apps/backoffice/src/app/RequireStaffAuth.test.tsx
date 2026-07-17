import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { useStaffAuthStore } from '../features/auth/staffAuthStore';
import { RequireStaffAuth } from './RequireStaffAuth';

function renderGuarded() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route
          path="/"
          element={
            <RequireStaffAuth>
              <div>Protected settlement content</div>
            </RequireStaffAuth>
          }
        />
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireStaffAuth', () => {
  it('renders nothing while the silent-refresh bootstrap has not settled yet', () => {
    useStaffAuthStore.setState({ accessToken: null, user: null, isInitialized: false });
    renderGuarded();

    expect(screen.queryByText('Protected settlement content')).not.toBeInTheDocument();
    expect(screen.queryByText('Login page')).not.toBeInTheDocument();
  });

  it('redirects to /login once initialized with no session', () => {
    useStaffAuthStore.setState({ accessToken: null, user: null, isInitialized: true });
    renderGuarded();

    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('renders the protected content once authenticated', () => {
    useStaffAuthStore.setState({
      accessToken: 'header.payload.signature',
      user: { sub: 'staff-1', username: 'trader_bob', role: 'TRADING' },
      isInitialized: true,
    });
    renderGuarded();

    expect(screen.getByText('Protected settlement content')).toBeInTheDocument();
  });
});
