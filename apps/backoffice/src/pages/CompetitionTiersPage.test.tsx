import type { Match } from '@sportsbook/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStaffAuthStore } from '../features/auth/staffAuthStore';
import type { CompetitionTier } from '../lib/backendApi';
import CompetitionTiersPage from './CompetitionTiersPage';

const liveMatch: Match = {
  id: 'match-1',
  sport: 'Football',
  country: 'England',
  competition: 'Premier League',
  homeTeam: 'Arsenal',
  awayTeam: 'Chelsea',
  kickoff: '2026-07-18T15:00:00Z',
  isLive: false,
  markets: [],
};

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <CompetitionTiersPage />
    </QueryClientProvider>,
  );
}

function stubFetch(tiers: CompetitionTier[]) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method ?? 'GET';

    if (method === 'GET' && url === '/api/events') {
      return new Response(JSON.stringify([liveMatch]), { status: 200 });
    }
    if (method === 'GET' && url === '/backend/admin/competition-tiers') {
      return new Response(JSON.stringify(tiers), { status: 200 });
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

async function drillToCountry() {
  await userEvent.click(await screen.findByRole('button', { name: /Football/ }));
  await userEvent.click(screen.getByRole('button', { name: /England/ }));
}

describe('CompetitionTiersPage', () => {
  it('lists competitions once drilled into sport > country', async () => {
    stubFetch([]);
    renderPage();

    expect(screen.queryByText('Premier League')).not.toBeInTheDocument();
    await drillToCountry();

    expect(await screen.findByText('Premier League')).toBeInTheDocument();
    expect(screen.getByLabelText('Premier League tier')).toHaveValue('untiered');
  });

  it('sets a tier via the select', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'GET' && url === '/api/events') {
        return new Response(JSON.stringify([liveMatch]), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/admin/competition-tiers') {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (method === 'POST' && url === '/backend/admin/competition-tiers') {
        expect(JSON.parse(init!.body as string)).toEqual({ competition: 'Premier League', tier: 2 });
        return new Response(
          JSON.stringify({
            id: 'tier-1',
            competition: 'Premier League',
            tier: 2,
            createdAt: '2026-07-18T00:00:00Z',
            updatedAt: '2026-07-18T00:00:00Z',
          }),
          { status: 201 },
        );
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();
    await drillToCountry();
    await userEvent.selectOptions(await screen.findByLabelText('Premier League tier'), '2');

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/competition-tiers',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
