import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../features/auth/authStore';
import { useAuthModalStore } from '../features/auth/authModalStore';
import { useBrandStore } from '../features/brand/brandStore';
import RegisterPage from './RegisterPage';

const TEST_BRAND_ID = 'test-brand-id';

function renderRegisterPage() {
  return render(<RegisterPage />);
}

beforeEach(() => {
  useAuthStore.setState({ accessToken: null, user: null, isInitialized: false });
  useAuthModalStore.setState({ mode: 'register' });
  // Normally set by useBrandTheme once brand resolution completes - this
  // page doesn't render inside AppShell here, so it's seeded directly.
  useBrandStore.setState({ brandId: TEST_BRAND_ID });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RegisterPage', () => {
  it('renders as a bottom-sheet modal that closes on dismiss', async () => {
    const { container } = renderRegisterPage();

    expect(container.querySelector('.sheet-slide-up')).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', { name: 'Close registration' })[0] as HTMLElement);

    expect(useAuthModalStore.getState().mode).toBeNull();
  });

  it('registers and closes the modal on success', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ accessToken: 'header.payload.signature' }), { status: 201 }),
      );
    vi.stubGlobal('fetch', fetchMock);

    renderRegisterPage();

    await userEvent.type(screen.getByLabelText('Email'), 'new@example.com');
    await userEvent.type(screen.getByLabelText('Username'), 'new_user');
    await userEvent.type(screen.getByLabelText('Phone number'), '+15551234567');
    await userEvent.type(screen.getByLabelText('Password'), 'correct-horse-battery-staple');
    await userEvent.click(screen.getByRole('button', { name: 'Register' }));

    await vi.waitFor(() => expect(useAuthModalStore.getState().mode).toBeNull());
    expect(useAuthStore.getState().accessToken).toBe('header.payload.signature');

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(requestInit.body as string)).toEqual({
      email: 'new@example.com',
      username: 'new_user',
      phone: '+15551234567',
      password: 'correct-horse-battery-staple',
      brandId: TEST_BRAND_ID,
    });
  });

  it('shows the server error message when registration fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ message: 'Email, username, or phone number already in use' }),
            { status: 409 },
          ),
        ),
    );

    renderRegisterPage();

    await userEvent.type(screen.getByLabelText('Email'), 'taken@example.com');
    await userEvent.type(screen.getByLabelText('Username'), 'taken_user');
    await userEvent.type(screen.getByLabelText('Phone number'), '+15551234567');
    await userEvent.type(screen.getByLabelText('Password'), 'correct-horse-battery-staple');
    await userEvent.click(screen.getByRole('button', { name: 'Register' }));

    expect(
      await screen.findByText('Email, username, or phone number already in use'),
    ).toBeInTheDocument();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('switches to the login modal when "Log in" is clicked', async () => {
    renderRegisterPage();

    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(useAuthModalStore.getState().mode).toBe('login');
  });
});
