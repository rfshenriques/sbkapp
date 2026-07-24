import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../features/auth/authStore';
import { useAuthModalStore } from '../features/auth/authModalStore';
import LoginPage from './LoginPage';

function renderLoginPage() {
  return render(<LoginPage />);
}

beforeEach(() => {
  useAuthStore.setState({ accessToken: null, user: null, isInitialized: false });
  useAuthModalStore.setState({ mode: 'login' });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LoginPage', () => {
  it('closes the modal when the backdrop is clicked', async () => {
    renderLoginPage();

    await userEvent.click(screen.getAllByRole('button', { name: 'Close login' })[0] as HTMLElement);

    expect(useAuthModalStore.getState().mode).toBeNull();
  });

  it('logs in and closes the modal on success', async () => {
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

    await vi.waitFor(() => expect(useAuthModalStore.getState().mode).toBeNull());
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

  it('switches to the register modal when "Register" is clicked', async () => {
    renderLoginPage();

    await userEvent.click(screen.getByRole('button', { name: 'Register' }));

    expect(useAuthModalStore.getState().mode).toBe('register');
  });
});
