import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { useMasterAuthStore } from '../features/auth/masterAuthStore';
import { RequireMasterAuth } from './RequireMasterAuth';

function renderGuarded() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route
          path="/"
          element={
            <RequireMasterAuth>
              <div>Protected brands content</div>
            </RequireMasterAuth>
          }
        />
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireMasterAuth', () => {
  it('renders nothing while the silent-refresh bootstrap has not settled yet', () => {
    useMasterAuthStore.setState({ accessToken: null, user: null, isInitialized: false });
    renderGuarded();

    expect(screen.queryByText('Protected brands content')).not.toBeInTheDocument();
    expect(screen.queryByText('Login page')).not.toBeInTheDocument();
  });

  it('redirects to /login once initialized with no session', () => {
    useMasterAuthStore.setState({ accessToken: null, user: null, isInitialized: true });
    renderGuarded();

    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('renders the protected content once authenticated', () => {
    useMasterAuthStore.setState({
      accessToken: 'header.payload.signature',
      user: { sub: 'master-1', username: 'owner' },
      isInitialized: true,
    });
    renderGuarded();

    expect(screen.getByText('Protected brands content')).toBeInTheDocument();
  });
});
