import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStaffAuthStore } from '../features/auth/staffAuthStore';
import StaffLoginPage from './StaffLoginPage';

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<StaffLoginPage />} />
        <Route path="/" element={<div>Settlement page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useStaffAuthStore.setState({ accessToken: null, user: null, isInitialized: false });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('StaffLoginPage', () => {
  it('logs in and navigates to the settlement page on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ accessToken: 'header.payload.signature' }), {
          status: 200,
        }),
      ),
    );

    renderLoginPage();

    await userEvent.type(screen.getByLabelText('Email or username'), 'trader_bob');
    await userEvent.type(screen.getByLabelText('Password'), 'correct-horse-battery-staple');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Settlement page')).toBeInTheDocument();
    expect(useStaffAuthStore.getState().accessToken).toBe('header.payload.signature');
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

    await userEvent.type(screen.getByLabelText('Email or username'), 'trader_bob');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
    expect(useStaffAuthStore.getState().accessToken).toBeNull();
  });
});
