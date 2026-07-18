import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StaffUser } from '../lib/backendApi';
import StaffUsersPage from './StaffUsersPage';

const existingStaffUser: StaffUser = {
  id: 'staff-1',
  username: 'trader_bob',
  email: 'trader_bob@example.com',
  role: 'TRADING',
  createdAt: '2026-07-01T00:00:00Z',
};

function renderStaffUsersPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <StaffUsersPage />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('StaffUsersPage', () => {
  it('lists existing staff users', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify([existingStaffUser]), { status: 200 })),
    );

    renderStaffUsersPage();

    expect(await screen.findByText('trader_bob')).toBeInTheDocument();
    expect(screen.getByText('trader_bob@example.com')).toBeInTheDocument();
  });

  it('submits the new-staff-user form and refetches the list', async () => {
    const createdStaffUser: StaffUser = {
      id: 'staff-2',
      username: 'new_trader',
      email: 'new_trader@example.com',
      role: 'RISK',
      createdAt: '2026-07-18T00:00:00Z',
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'POST' && url === '/backend/admin/staff-users') {
        expect(JSON.parse(init!.body as string)).toEqual({
          username: 'new_trader',
          email: 'new_trader@example.com',
          password: 'correct-horse-battery-staple',
          role: 'RISK',
        });
        return new Response(JSON.stringify(createdStaffUser), { status: 201 });
      }
      if (method === 'GET' && url === '/backend/admin/staff-users') {
        return new Response(JSON.stringify([existingStaffUser]), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderStaffUsersPage();
    await screen.findByText('trader_bob');

    await userEvent.type(screen.getByLabelText('Username'), 'new_trader');
    await userEvent.type(screen.getByLabelText('Email'), 'new_trader@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'correct-horse-battery-staple');
    await userEvent.selectOptions(screen.getByLabelText('Role'), 'RISK');
    await userEvent.click(screen.getByRole('button', { name: 'Add staff user' }));

    expect(
      fetchMock.mock.calls.some(([input, init]) => {
        const url = typeof input === 'string' ? input : input.toString();
        return url === '/backend/admin/staff-users' && init?.method === 'POST';
      }),
    ).toBe(true);
  });

  it('shows the server error message when creation fails', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'POST' && url === '/backend/admin/staff-users') {
        return new Response(JSON.stringify({ message: 'Email or username already in use' }), {
          status: 409,
        });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderStaffUsersPage();
    await screen.findByRole('button', { name: 'Add staff user' });

    await userEvent.type(screen.getByLabelText('Username'), 'trader_bob');
    await userEvent.type(screen.getByLabelText('Email'), 'trader_bob@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'correct-horse-battery-staple');
    await userEvent.click(screen.getByRole('button', { name: 'Add staff user' }));

    expect(await screen.findByText('Email or username already in use')).toBeInTheDocument();
  });
});
