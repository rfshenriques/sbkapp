import type { Match } from '@sportsbook/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStaffAuthStore } from '../features/auth/staffAuthStore';
import type { CompetitionSuspension } from '../lib/backendApi';
import CompetitionSuspensionsPage from './CompetitionSuspensionsPage';

const eplMatch: Match = {
  id: 'match-1',
  sport: 'Football',
  country: 'England',
  competition: 'EPL',
  homeTeam: 'Arsenal',
  awayTeam: 'Chelsea',
  kickoff: '2026-07-18T15:00:00Z',
  isLive: false,
  markets: [],
};

const laLigaMatch: Match = {
  id: 'match-2',
  sport: 'Football',
  country: 'Spain',
  competition: 'La Liga',
  homeTeam: 'Barcelona',
  awayTeam: 'Real Madrid',
  kickoff: '2026-07-18T18:00:00Z',
  isLive: false,
  markets: [],
};

const eplSuspension: CompetitionSuspension = {
  id: 'suspension-1',
  brandId: 'brand-1',
  competition: 'EPL',
  reason: null,
  createdAt: '2026-07-18T00:00:00Z',
};

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <CompetitionSuspensionsPage />
    </QueryClientProvider>,
  );
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

describe('CompetitionSuspensionsPage', () => {
  it('lists every competition from the live feed, showing which are suspended', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/events') {
        return new Response(JSON.stringify([eplMatch, laLigaMatch]), { status: 200 });
      }
      if (url === '/backend/admin/competition-suspensions') {
        return new Response(JSON.stringify([eplSuspension]), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    expect(await screen.findByText('EPL')).toBeInTheDocument();
    expect(await screen.findByText('La Liga')).toBeInTheDocument();
    expect(screen.getByText('Suspended')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unsuspend' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Suspend' })).toBeInTheDocument();
  });

  it('suspending a competition posts its name', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'GET' && url === '/api/events') {
        return new Response(JSON.stringify([laLigaMatch]), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/admin/competition-suspensions') {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (method === 'POST' && url === '/backend/admin/competition-suspensions') {
        expect(JSON.parse(init!.body as string)).toEqual({ competition: 'La Liga', reason: undefined });
        return new Response(
          JSON.stringify({ id: 'suspension-2', brandId: 'brand-1', competition: 'La Liga', reason: null, createdAt: '2026-07-18T00:00:00Z' }),
          { status: 201 },
        );
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();
    await screen.findByText('La Liga');

    await userEvent.click(screen.getByRole('button', { name: 'Suspend' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/competition-suspensions',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('unsuspending sends a delete for the suspension id', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'GET' && url === '/api/events') {
        return new Response(JSON.stringify([eplMatch]), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/admin/competition-suspensions') {
        return new Response(JSON.stringify([eplSuspension]), { status: 200 });
      }
      if (method === 'DELETE' && url === '/backend/admin/competition-suspensions/suspension-1') {
        return new Response(JSON.stringify(eplSuspension), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();
    await screen.findByText('EPL');

    await userEvent.click(screen.getByRole('button', { name: 'Unsuspend' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/competition-suspensions/suspension-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
