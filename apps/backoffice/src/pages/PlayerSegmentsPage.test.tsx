import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStaffAuthStore } from '../features/auth/staffAuthStore';
import type { PlayerSegment } from '../lib/backendApi';
import PlayerSegmentsPage from './PlayerSegmentsPage';

const highRollers: PlayerSegment = {
  id: 'segment-1',
  brandId: 'brand-1',
  name: 'High rollers',
  description: 'Big stakes',
  createdAt: '2026-07-24T00:00:00Z',
  updatedAt: '2026-07-24T00:00:00Z',
  members: [
    {
      id: 'member-1',
      userId: 'user-1',
      addedAt: '2026-07-24T00:00:00Z',
      user: { id: 'user-1', email: 'alice@example.com', username: 'alice' },
    },
  ],
};

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <PlayerSegmentsPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useStaffAuthStore.setState({
    accessToken: 'header.payload.signature',
    user: { sub: 'staff-1', username: 'crm_alice', role: 'CRM' },
    isInitialized: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PlayerSegmentsPage', () => {
  it('lists segments with member counts, collapsed by default', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url === '/backend/admin/player-segments') {
          return new Response(JSON.stringify([highRollers]), { status: 200 });
        }
        return new Response(null, { status: 404 });
      }),
    );

    renderPage();

    expect(await screen.findByText(/High rollers/)).toBeInTheDocument();
    expect(screen.getByText('(1)')).toBeInTheDocument();
    expect(screen.queryByText('alice@example.com', { exact: false })).not.toBeInTheDocument();
  });

  it('expanding a segment shows its members and lets staff add another by identifier', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';
      if (method === 'GET' && url === '/backend/admin/player-segments') {
        return new Response(JSON.stringify([highRollers]), { status: 200 });
      }
      if (method === 'POST' && url === '/backend/admin/player-segments/segment-1/members') {
        expect(JSON.parse(init!.body as string)).toEqual({ identifier: 'bob' });
        return new Response(JSON.stringify({ ...highRollers.members[0], id: 'member-2' }), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /High rollers/ }));

    expect(await screen.findByText('alice@example.com', { exact: false })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Add player to High rollers'), 'bob');
    await userEvent.click(screen.getByRole('button', { name: 'Add player' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/player-segments/segment-1/members',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('removing a member sends a delete for that user', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';
      if (method === 'GET' && url === '/backend/admin/player-segments') {
        return new Response(JSON.stringify([highRollers]), { status: 200 });
      }
      if (method === 'DELETE' && url === '/backend/admin/player-segments/segment-1/members/user-1') {
        return new Response(JSON.stringify(highRollers.members[0]), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /High rollers/ }));
    await screen.findByText('alice@example.com', { exact: false });

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/player-segments/segment-1/members/user-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('creating a new segment posts its name and description', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';
      if (method === 'GET' && url === '/backend/admin/player-segments') {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (method === 'POST' && url === '/backend/admin/player-segments') {
        expect(JSON.parse(init!.body as string)).toEqual({ name: 'VIP' });
        return new Response(JSON.stringify({ ...highRollers, id: 'segment-2', name: 'VIP', members: [] }), {
          status: 200,
        });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();
    await screen.findByText('No segments yet - create one above.');

    await userEvent.type(screen.getByLabelText('Segment name'), 'VIP');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/player-segments',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
