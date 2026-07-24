import type { Match } from '@sportsbook/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStaffAuthStore } from '../features/auth/staffAuthStore';
import type { ManualMarket } from '../lib/backendApi';
import ManualMarketsPage from './ManualMarketsPage';

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

function renderManualMarketsPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ManualMarketsPage />
    </QueryClientProvider>,
  );
}

function stubFetch(manualMarkets: ManualMarket[]) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method ?? 'GET';

    if (method === 'GET' && url === '/api/events') {
      return new Response(JSON.stringify([liveMatch]), { status: 200 });
    }
    if (method === 'GET' && url === '/backend/admin/manual-markets') {
      return new Response(JSON.stringify(manualMarkets), { status: 200 });
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

async function drillToLeague() {
  await userEvent.click(await screen.findByRole('button', { name: /Football/ }));
  await userEvent.click(screen.getByRole('button', { name: /England/ }));
  await userEvent.click(screen.getByRole('button', { name: /Premier League/ }));
}

describe('ManualMarketsPage', () => {
  it('lists live matches from the odds-engine once drilled into their league', async () => {
    stubFetch([]);
    renderManualMarketsPage();
    await drillToLeague();

    expect(await screen.findByText(/Arsenal vs Chelsea/)).toBeInTheDocument();
  });

  it('expanding a match with no manual markets shows only the new-market form', async () => {
    stubFetch([]);
    renderManualMarketsPage();
    await drillToLeague();

    await userEvent.click(await screen.findByText(/Arsenal vs Chelsea/));

    expect(await screen.findByLabelText('New market name')).toBeInTheDocument();
    expect(screen.queryByText('Remove market')).not.toBeInTheDocument();
  });

  it('expanding a match with an existing manual market lists it with its selections', async () => {
    stubFetch([
      {
        id: 'market-1',
        matchId: 'match-1',
        name: 'To Win Both Halves',
        createdAt: '2026-07-18T00:00:00Z',
        maxStakeCents: null,
        maxLiabilityCents: null,
        currentLiabilityCents: 0,
        audienceMode: 'ALL',
        audienceSegments: [],
        selections: [
          { id: 'sel-1', name: 'Yes', odds: 3.5 },
          { id: 'sel-2', name: 'No', odds: 1.25 },
        ],
      },
    ]);
    renderManualMarketsPage();
    await drillToLeague();

    expect(await screen.findByText('1 manual market')).toBeInTheDocument();
    await userEvent.click(screen.getByText(/Arsenal vs Chelsea/));

    expect(await screen.findByText('To Win Both Halves')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('3.50')).toBeInTheDocument();
  });

  it('creating a market sends matchId/name/selections and shows it in the list', async () => {
    let manualMarkets: ManualMarket[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'GET' && url === '/api/events') {
        return new Response(JSON.stringify([liveMatch]), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/admin/manual-markets') {
        return new Response(JSON.stringify(manualMarkets), { status: 200 });
      }
      if (method === 'POST' && url === '/backend/admin/manual-markets') {
        expect(JSON.parse(init!.body as string)).toEqual({
          matchId: 'match-1',
          name: 'Novelty Market',
          selections: [
            { name: 'Yes', odds: 2.5 },
            { name: 'No', odds: 1.5 },
          ],
        });
        manualMarkets = [
          {
            id: 'market-new',
            matchId: 'match-1',
            name: 'Novelty Market',
            createdAt: '2026-07-18T00:00:00Z',
            maxStakeCents: null,
            maxLiabilityCents: null,
            currentLiabilityCents: 0,
            audienceMode: 'ALL',
            audienceSegments: [],
            selections: [
              { id: 'sel-a', name: 'Yes', odds: 2.5 },
              { id: 'sel-b', name: 'No', odds: 1.5 },
            ],
          },
        ];
        return new Response(JSON.stringify(manualMarkets[0]), { status: 201 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderManualMarketsPage();
    await drillToLeague();
    await userEvent.click(await screen.findByText(/Arsenal vs Chelsea/));

    await userEvent.type(screen.getByLabelText('New market name'), 'Novelty Market');
    await userEvent.type(screen.getByLabelText('New selection 1 name'), 'Yes');
    await userEvent.type(screen.getByLabelText('New selection 1 odds'), '2.5');
    await userEvent.type(screen.getByLabelText('New selection 2 name'), 'No');
    await userEvent.type(screen.getByLabelText('New selection 2 odds'), '1.5');
    await userEvent.click(screen.getByRole('button', { name: 'Create market' }));

    expect(await screen.findByText('Novelty Market')).toBeInTheDocument();
  });

  it('editing a market pre-fills the form and sends a PATCH with the full replacement selection list', async () => {
    let manualMarkets: ManualMarket[] = [
      {
        id: 'market-1',
        matchId: 'match-1',
        name: 'To Win Both Halves',
        createdAt: '2026-07-18T00:00:00Z',
        maxStakeCents: null,
        maxLiabilityCents: null,
        currentLiabilityCents: 0,
        audienceMode: 'ALL',
        audienceSegments: [],
        selections: [
          { id: 'sel-1', name: 'Yes', odds: 3.5 },
          { id: 'sel-2', name: 'No', odds: 1.25 },
        ],
      },
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'GET' && url === '/api/events') {
        return new Response(JSON.stringify([liveMatch]), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/admin/manual-markets') {
        return new Response(JSON.stringify(manualMarkets), { status: 200 });
      }
      if (method === 'PATCH' && url === '/backend/admin/manual-markets/market-1') {
        expect(JSON.parse(init!.body as string)).toEqual({
          name: 'To Win Both Halves (fixed)',
          selections: [
            { name: 'Yes', odds: 3.5 },
            { name: 'No', odds: 1.25 },
          ],
        });
        manualMarkets = [{ ...manualMarkets[0]!, name: 'To Win Both Halves (fixed)' }];
        return new Response(JSON.stringify(manualMarkets[0]), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderManualMarketsPage();
    await drillToLeague();
    await userEvent.click(await screen.findByText(/Arsenal vs Chelsea/));
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));

    const nameInput = screen.getByLabelText('Edit market name');
    expect(nameInput).toHaveValue('To Win Both Halves');
    expect(screen.getByLabelText('Edit selection 1 name')).toHaveValue('Yes');
    expect(screen.getByLabelText('Edit selection 1 odds')).toHaveValue('3.5');

    await userEvent.type(nameInput, ' (fixed)');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('To Win Both Halves (fixed)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Edit market name')).not.toBeInTheDocument();
  });

  it('cancelling an edit discards changes and restores the static view', async () => {
    stubFetch([
      {
        id: 'market-1',
        matchId: 'match-1',
        name: 'To Win Both Halves',
        createdAt: '2026-07-18T00:00:00Z',
        maxStakeCents: null,
        maxLiabilityCents: null,
        currentLiabilityCents: 0,
        audienceMode: 'ALL',
        audienceSegments: [],
        selections: [{ id: 'sel-1', name: 'Yes', odds: 3.5 }],
      },
    ]);

    renderManualMarketsPage();
    await drillToLeague();
    await userEvent.click(await screen.findByText(/Arsenal vs Chelsea/));
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByLabelText('Edit market name')).not.toBeInTheDocument();
    expect(screen.getByText('To Win Both Halves')).toBeInTheDocument();
  });

  it('removing a market sends a DELETE for its id', async () => {
    let manualMarkets: ManualMarket[] = [
      {
        id: 'market-1',
        matchId: 'match-1',
        name: 'To Win Both Halves',
        createdAt: '2026-07-18T00:00:00Z',
        maxStakeCents: null,
        maxLiabilityCents: null,
        currentLiabilityCents: 0,
        audienceMode: 'ALL',
        audienceSegments: [],
        selections: [{ id: 'sel-1', name: 'Yes', odds: 3.5 }],
      },
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'GET' && url === '/api/events') {
        return new Response(JSON.stringify([liveMatch]), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/admin/manual-markets') {
        return new Response(JSON.stringify(manualMarkets), { status: 200 });
      }
      if (method === 'DELETE' && url === '/backend/admin/manual-markets/market-1') {
        manualMarkets = [];
        return new Response(null, { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderManualMarketsPage();
    await drillToLeague();
    await userEvent.click(await screen.findByText(/Arsenal vs Chelsea/));
    await userEvent.click(await screen.findByRole('button', { name: 'Remove market' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/manual-markets/market-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('saving max stake/liability sends a PATCH to the limits endpoint', async () => {
    const manualMarkets: ManualMarket[] = [
      {
        id: 'market-1',
        matchId: 'match-1',
        name: 'To Win Both Halves',
        createdAt: '2026-07-18T00:00:00Z',
        maxStakeCents: null,
        maxLiabilityCents: null,
        currentLiabilityCents: 0,
        audienceMode: 'ALL',
        audienceSegments: [],
        selections: [{ id: 'sel-1', name: 'Yes', odds: 3.5 }],
      },
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'GET' && url === '/api/events') {
        return new Response(JSON.stringify([liveMatch]), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/admin/manual-markets') {
        return new Response(JSON.stringify(manualMarkets), { status: 200 });
      }
      if (method === 'PATCH' && url === '/backend/admin/manual-markets/market-1/limits') {
        expect(JSON.parse(init!.body as string)).toEqual({
          maxStakeCents: 10_000,
          maxLiabilityCents: null,
          audienceMode: 'ALL',
          segmentIds: [],
        });
        return new Response(JSON.stringify(manualMarkets[0]), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderManualMarketsPage();
    await drillToLeague();
    await userEvent.click(await screen.findByText(/Arsenal vs Chelsea/));

    await userEvent.type(await screen.findByLabelText('To Win Both Halves limits max stake'), '100');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/manual-markets/market-1/limits',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });
});
