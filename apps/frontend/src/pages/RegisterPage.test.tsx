import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../features/auth/authStore';
import RegisterPage from './RegisterPage';

function renderRegisterPage() {
  return render(
    <MemoryRouter initialEntries={['/register']}>
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
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

describe('RegisterPage', () => {
  it('registers and navigates to the odds board on success', async () => {
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

    expect(await screen.findByText('Odds board')).toBeInTheDocument();
    expect(useAuthStore.getState().accessToken).toBe('header.payload.signature');

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(requestInit.body as string)).toEqual({
      email: 'new@example.com',
      username: 'new_user',
      phone: '+15551234567',
      password: 'correct-horse-battery-staple',
      // Whatever this environment is configured with (see VITE_BRAND_ID)
      // - not hardcoded, so this test doesn't drift from the real value.
      brandId: import.meta.env.VITE_BRAND_ID,
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
});
