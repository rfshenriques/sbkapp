import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMasterAuthStore } from '../features/auth/masterAuthStore';
import MasterLoginPage from './MasterLoginPage';

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<MasterLoginPage />} />
        <Route path="/" element={<div>Brands page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useMasterAuthStore.setState({ accessToken: null, user: null, isInitialized: false });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MasterLoginPage', () => {
  it('logs in and navigates to the brands page on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ accessToken: 'header.payload.signature' }), {
          status: 200,
        }),
      ),
    );

    renderLoginPage();

    await userEvent.type(screen.getByLabelText('Email or username'), 'owner');
    await userEvent.type(screen.getByLabelText('Password'), 'correct-horse-battery-staple');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Brands page')).toBeInTheDocument();
    expect(useMasterAuthStore.getState().accessToken).toBe('header.payload.signature');
  });

  it('shows the server error message when login fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ message: 'Invalid credentials' }), { status: 401 }),
        ),
    );

    renderLoginPage();

    await userEvent.type(screen.getByLabelText('Email or username'), 'owner');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
    expect(useMasterAuthStore.getState().accessToken).toBeNull();
  });
});
