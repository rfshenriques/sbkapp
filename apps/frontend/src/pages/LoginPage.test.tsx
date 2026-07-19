import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../features/auth/authStore';
import LoginPage from './LoginPage';

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<div>Odds board</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useAuthStore.setState({ accessToken: null, user: null, isInitialized: false });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LoginPage', () => {
  it('closes back to the previous page when the backdrop is clicked', async () => {
    renderLoginPage();

    await userEvent.click(screen.getAllByRole('button', { name: 'Close login' })[0] as HTMLElement);

    expect(await screen.findByText('Odds board')).toBeInTheDocument();
  });


  it('logs in and navigates to the odds board on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ accessToken: 'header.payload.signature' }), {
          status: 200,
        }),
      ),
    );

    renderLoginPage();

    await userEvent.type(screen.getByLabelText('Email or username'), 'someone');
    await userEvent.type(screen.getByLabelText('Password'), 'correct-horse-battery-staple');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Odds board')).toBeInTheDocument();
    expect(useAuthStore.getState().accessToken).toBe('header.payload.signature');
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

    await userEvent.type(screen.getByLabelText('Email or username'), 'someone');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
