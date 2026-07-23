import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStaffAuthStore } from '../features/auth/staffAuthStore';
import type { OddsLadderRung } from '../lib/backendApi';
import OddsLadderPage from './OddsLadderPage';

function renderOddsLadderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <OddsLadderPage />
    </QueryClientProvider>,
  );
}

function stubFetch(rungs: OddsLadderRung[]) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method ?? 'GET';

    if (method === 'GET' && url === '/backend/admin/odds-ladder') {
      return new Response(JSON.stringify(rungs), { status: 200 });
    }
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  useStaffAuthStore.setState({
    accessToken: 'header.payload.signature',
    user: { sub: 'staff-1', username: 'trader_bob', role: 'TRADING' },
    isInitialized: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OddsLadderPage', () => {
  it('shows an empty state when no rungs are configured', async () => {
    stubFetch([]);
    renderOddsLadderPage();

    expect(
      await screen.findByText('No rungs configured yet - generate the standard ladder to get started.'),
    ).toBeInTheDocument();
  });

  it('lists rungs ascending with their count', async () => {
    stubFetch([
      { id: 'r1', value: 2.5, createdAt: '2026-07-18T00:00:00Z' },
      { id: 'r2', value: 1.5, createdAt: '2026-07-18T00:00:00Z' },
    ]);
    renderOddsLadderPage();

    expect(await screen.findByText('2 rungs')).toBeInTheDocument();
    expect(screen.getByText('1.50')).toBeInTheDocument();
    expect(screen.getByText('2.50')).toBeInTheDocument();
  });

  it('generating the standard ladder posts to generate-standard and refreshes the list', async () => {
    let rungs: OddsLadderRung[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'GET' && url === '/backend/admin/odds-ladder') {
        return new Response(JSON.stringify(rungs), { status: 200 });
      }
      if (method === 'POST' && url === '/backend/admin/odds-ladder/generate-standard') {
        rungs = [{ id: 'r1', value: 1.01, createdAt: '2026-07-18T00:00:00Z' }];
        return new Response(JSON.stringify(rungs), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderOddsLadderPage();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Generate standard ladder (replaces current)' }),
    );

    expect(await screen.findByText('1.01')).toBeInTheDocument();
  });

  it('adding a rung sends its value and shows it in the list', async () => {
    let rungs: OddsLadderRung[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'GET' && url === '/backend/admin/odds-ladder') {
        return new Response(JSON.stringify(rungs), { status: 200 });
      }
      if (method === 'POST' && url === '/backend/admin/odds-ladder') {
        expect(JSON.parse(init!.body as string)).toEqual({ value: 2.5 });
        rungs = [{ id: 'r1', value: 2.5, createdAt: '2026-07-18T00:00:00Z' }];
        return new Response(JSON.stringify(rungs[0]), { status: 201 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderOddsLadderPage();
    await userEvent.type(await screen.findByLabelText('New rung value'), '2.5');
    await userEvent.click(screen.getByRole('button', { name: 'Add rung' }));

    expect(await screen.findByText('2.50')).toBeInTheDocument();
  });

  it('removing a rung sends a DELETE for its id', async () => {
    let rungs: OddsLadderRung[] = [{ id: 'r1', value: 2.5, createdAt: '2026-07-18T00:00:00Z' }];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'GET' && url === '/backend/admin/odds-ladder') {
        return new Response(JSON.stringify(rungs), { status: 200 });
      }
      if (method === 'DELETE' && url === '/backend/admin/odds-ladder/r1') {
        rungs = [];
        return new Response(null, { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderOddsLadderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Remove rung 2.50' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/odds-ladder/r1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
