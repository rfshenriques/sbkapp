import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStaffAuthStore } from '../features/auth/staffAuthStore';
import type { FreebetGrant } from '../lib/backendApi';
import FreebetsPage from './FreebetsPage';

const activeGrant: FreebetGrant = {
  id: 'grant-1',
  userId: 'user-1',
  brandId: 'brand-1',
  amountCents: 1000,
  source: 'MANUAL',
  note: 'Goodwill gesture',
  status: 'ACTIVE',
  expiresAt: null,
  spentAt: null,
  spentOnBetId: null,
  voidedAt: null,
  createdByStaffUserId: 'staff-1',
  createdByUsername: 'crm_alice',
  createdAt: '2026-07-24T00:00:00Z',
  updatedAt: '2026-07-24T00:00:00Z',
};

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <FreebetsPage />
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

describe('FreebetsPage', () => {
  it('looking up a player shows their freebets and a grant form', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url === '/backend/admin/freebets/alice') {
          return new Response(JSON.stringify([activeGrant]), { status: 200 });
        }
        return new Response(null, { status: 404 });
      }),
    );

    renderPage();
    await userEvent.type(screen.getByLabelText('Player email or username'), 'alice');
    await userEvent.click(screen.getByRole('button', { name: 'Look up' }));

    expect(await screen.findByText('€10.00')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText(/Granted by crm_alice/)).toBeInTheDocument();
    expect(screen.getByText(/Goodwill gesture/)).toBeInTheDocument();
    expect(screen.getByLabelText('Freebet amount')).toBeInTheDocument();
  });

  it('shows an empty state when the player has no freebets yet', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url === '/backend/admin/freebets/bob') {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        return new Response(null, { status: 404 });
      }),
    );

    renderPage();
    await userEvent.type(screen.getByLabelText('Player email or username'), 'bob');
    await userEvent.click(screen.getByRole('button', { name: 'Look up' }));

    expect(await screen.findByText('No freebets for this player yet.')).toBeInTheDocument();
  });

  it('granting a freebet posts the identifier and amount in cents', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';
      if (method === 'GET' && url === '/backend/admin/freebets/alice') {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (method === 'POST' && url === '/backend/admin/freebets') {
        const body = JSON.parse(init!.body as string);
        expect(body).toEqual({ identifier: 'alice', amountCents: 1500 });
        return new Response(JSON.stringify({ ...activeGrant, id: 'grant-2', amountCents: 1500 }), { status: 201 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();
    await userEvent.type(screen.getByLabelText('Player email or username'), 'alice');
    await userEvent.click(screen.getByRole('button', { name: 'Look up' }));
    await screen.findByText('No freebets for this player yet.');

    await userEvent.type(screen.getByLabelText('Freebet amount'), '15');
    await userEvent.click(screen.getByRole('button', { name: 'Grant' }));

    expect(fetchMock).toHaveBeenCalledWith('/backend/admin/freebets', expect.objectContaining({ method: 'POST' }));
  });

  it('voiding an active freebet sends a DELETE for its id', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';
      if (method === 'GET' && url === '/backend/admin/freebets/alice') {
        return new Response(JSON.stringify([activeGrant]), { status: 200 });
      }
      if (method === 'DELETE' && url === '/backend/admin/freebets/grant-1') {
        return new Response(JSON.stringify({ ...activeGrant, status: 'VOIDED' }), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();
    await userEvent.type(screen.getByLabelText('Player email or username'), 'alice');
    await userEvent.click(screen.getByRole('button', { name: 'Look up' }));
    await screen.findByText('€10.00');

    await userEvent.click(screen.getByRole('button', { name: 'Void' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/freebets/grant-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
