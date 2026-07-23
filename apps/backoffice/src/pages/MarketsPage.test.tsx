import type { Match } from '@sportsbook/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStaffAuthStore } from '../features/auth/staffAuthStore';
import type { MarketSuspension } from '../lib/backendApi';
import MarketsPage from './MarketsPage';

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

const matchWithMarkets: Match = {
  ...liveMatch,
  markets: [
    {
      id: 'match-result',
      name: 'Match Result',
      selections: [
        { id: 'home', name: 'Home', odds: 2.1 },
        { id: 'away', name: 'Away', odds: 3.2 },
      ],
    },
  ],
};

function renderMarketsPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MarketsPage />
    </QueryClientProvider>,
  );
}

function stubFetch(suspensions: MarketSuspension[]) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method ?? 'GET';

    if (method === 'GET' && url === '/api/events') {
      return new Response(JSON.stringify([liveMatch]), { status: 200 });
    }
    if (method === 'GET' && url === '/api/events/match-1') {
      return new Response(JSON.stringify(matchWithMarkets), { status: 200 });
    }
    if (method === 'GET' && url === '/backend/admin/market-suspensions') {
      return new Response(JSON.stringify(suspensions), { status: 200 });
    }
    if (method === 'POST' && url === '/backend/admin/market-suspensions') {
      return new Response(
        JSON.stringify({
          id: 'suspension-1',
          matchId: 'match-1',
          marketId: '',
          selectionId: '',
          reason: null,
          createdAt: '2026-07-18T00:00:00Z',
        }),
        { status: 201 },
      );
    }
    if (method === 'DELETE' && url.startsWith('/backend/admin/market-suspensions/')) {
      return new Response(null, { status: 200 });
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

describe('MarketsPage', () => {
  it('lists live matches from the odds-engine', async () => {
    stubFetch([]);
    renderMarketsPage();

    expect(await screen.findByText(/Arsenal vs Chelsea/)).toBeInTheDocument();
  });

  it('suspending a match sends the right request and shows the suspended badge', async () => {
    let suspensions: MarketSuspension[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'GET' && url === '/api/events') {
        return new Response(JSON.stringify([liveMatch]), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/admin/market-suspensions') {
        return new Response(JSON.stringify(suspensions), { status: 200 });
      }
      if (method === 'POST' && url === '/backend/admin/market-suspensions') {
        expect(JSON.parse(init!.body as string)).toEqual({
          matchId: 'match-1',
          marketId: undefined,
          selectionId: undefined,
          reason: undefined,
        });
        suspensions = [
          {
            id: 'suspension-1',
            matchId: 'match-1',
            marketId: '',
            selectionId: '',
            reason: null,
            createdAt: '2026-07-18T00:00:00Z',
          },
        ];
        return new Response(JSON.stringify(suspensions[0]), { status: 201 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderMarketsPage();
    await screen.findByText(/Arsenal vs Chelsea/);

    await userEvent.click(screen.getByRole('button', { name: 'Suspend match' }));

    expect(await screen.findByText('Match suspended')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Unsuspend match' })).toBeInTheDocument();
  });

  it('expanding a match loads and lists its markets', async () => {
    stubFetch([]);
    renderMarketsPage();

    await userEvent.click(await screen.findByText(/Arsenal vs Chelsea/));

    expect(await screen.findByText('Match Result')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Suspend' })).toBeInTheDocument();
  });

  it('expanding a market lists its selections, each with its own suspend button', async () => {
    stubFetch([]);
    renderMarketsPage();

    await userEvent.click(await screen.findByText(/Arsenal vs Chelsea/));
    await userEvent.click(await screen.findByText('Match Result'));

    expect(await screen.findByText(/Home/)).toBeInTheDocument();
    expect(screen.getByText(/Away/)).toBeInTheDocument();
    // One "Suspend" for the market itself, one each for the two selections.
    expect(screen.getAllByRole('button', { name: 'Suspend' })).toHaveLength(3);
  });

  it('suspending a selection sends matchId/marketId/selectionId and shows its own badge', async () => {
    let suspensions: MarketSuspension[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'GET' && url === '/api/events') {
        return new Response(JSON.stringify([liveMatch]), { status: 200 });
      }
      if (method === 'GET' && url === '/api/events/match-1') {
        return new Response(JSON.stringify(matchWithMarkets), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/admin/market-suspensions') {
        return new Response(JSON.stringify(suspensions), { status: 200 });
      }
      if (method === 'POST' && url === '/backend/admin/market-suspensions') {
        expect(JSON.parse(init!.body as string)).toEqual({
          matchId: 'match-1',
          marketId: 'match-result',
          selectionId: 'home',
          reason: undefined,
        });
        suspensions = [
          {
            id: 'suspension-selection',
            matchId: 'match-1',
            marketId: 'match-result',
            selectionId: 'home',
            reason: null,
            createdAt: '2026-07-18T00:00:00Z',
          },
        ];
        return new Response(JSON.stringify(suspensions[0]), { status: 201 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderMarketsPage();
    await userEvent.click(await screen.findByText(/Arsenal vs Chelsea/));
    await userEvent.click(await screen.findByText('Match Result'));

    const homeRow = (await screen.findByText(/Home/)).closest('div')!;
    await userEvent.click(within(homeRow).getByRole('button', { name: 'Suspend' }));

    expect(await screen.findAllByText('Suspended')).not.toHaveLength(0);
  });
});
