import type { Match } from '@sportsbook/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStaffAuthStore } from '../features/auth/staffAuthStore';
import type { OddsOverride } from '../lib/backendApi';
import OddsOverridesPage from './OddsOverridesPage';

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

function renderOddsOverridesPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <OddsOverridesPage />
    </QueryClientProvider>,
  );
}

function stubFetch(overrides: OddsOverride[]) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method ?? 'GET';

    if (method === 'GET' && url === '/api/events') {
      return new Response(JSON.stringify([liveMatch]), { status: 200 });
    }
    if (method === 'GET' && url === '/api/events/match-1') {
      return new Response(JSON.stringify(matchWithMarkets), { status: 200 });
    }
    if (method === 'GET' && url === '/backend/admin/odds-overrides') {
      return new Response(JSON.stringify(overrides), { status: 200 });
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

describe('OddsOverridesPage', () => {
  it('lists live matches from the odds-engine once drilled into their league', async () => {
    stubFetch([]);
    renderOddsOverridesPage();

    expect(screen.queryByText(/Arsenal vs Chelsea/)).not.toBeInTheDocument();
    await drillToLeague();

    expect(await screen.findByText(/Arsenal vs Chelsea/)).toBeInTheDocument();
  });

  it('expanding a match then a market lists its selections with the current feed odds', async () => {
    stubFetch([]);
    renderOddsOverridesPage();

    await drillToLeague();
    await userEvent.click(await screen.findByText(/Arsenal vs Chelsea/));
    await userEvent.click(await screen.findByText('Match Result'));

    expect(await screen.findByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Away')).toBeInTheDocument();
    expect(screen.getByText('Feed 2.10')).toBeInTheDocument();
    expect(screen.getByText('Feed 3.20')).toBeInTheDocument();
  });

  it('setting a fixed price sends matchId/marketId/selectionId/oddsValue and shows the Overridden badge', async () => {
    let overrides: OddsOverride[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'GET' && url === '/api/events') {
        return new Response(JSON.stringify([liveMatch]), { status: 200 });
      }
      if (method === 'GET' && url === '/api/events/match-1') {
        return new Response(JSON.stringify(matchWithMarkets), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/admin/odds-overrides') {
        return new Response(JSON.stringify(overrides), { status: 200 });
      }
      if (method === 'POST' && url === '/backend/admin/odds-overrides') {
        expect(JSON.parse(init!.body as string)).toEqual({
          matchId: 'match-1',
          marketId: 'match-result',
          selectionId: 'home',
          oddsValue: 5,
          reason: undefined,
        });
        overrides = [
          {
            id: 'override-1',
            matchId: 'match-1',
            marketId: 'match-result',
            selectionId: 'home',
            oddsValue: 5,
            reason: null,
            createdAt: '2026-07-18T00:00:00Z',
            updatedAt: '2026-07-18T00:00:00Z',
          },
        ];
        return new Response(JSON.stringify(overrides[0]), { status: 201 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderOddsOverridesPage();
    await drillToLeague();
    await userEvent.click(await screen.findByText(/Arsenal vs Chelsea/));
    await userEvent.click(await screen.findByText('Match Result'));

    const homeRow = (await screen.findByText('Home')).closest('div')!;
    await userEvent.type(within(homeRow).getByLabelText('Fixed price for home'), '5');
    await userEvent.click(within(homeRow).getByRole('button', { name: 'Set' }));

    expect(await screen.findByText('Overridden')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Clear' })).toBeInTheDocument();
  });

  it('clearing an override sends a DELETE for its id', async () => {
    let overrides: OddsOverride[] = [
      {
        id: 'override-1',
        matchId: 'match-1',
        marketId: 'match-result',
        selectionId: 'home',
        oddsValue: 5,
        reason: null,
        createdAt: '2026-07-18T00:00:00Z',
        updatedAt: '2026-07-18T00:00:00Z',
      },
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'GET' && url === '/api/events') {
        return new Response(JSON.stringify([liveMatch]), { status: 200 });
      }
      if (method === 'GET' && url === '/api/events/match-1') {
        return new Response(JSON.stringify(matchWithMarkets), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/admin/odds-overrides') {
        return new Response(JSON.stringify(overrides), { status: 200 });
      }
      if (method === 'DELETE' && url === '/backend/admin/odds-overrides/override-1') {
        overrides = [];
        return new Response(null, { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderOddsOverridesPage();
    await drillToLeague();
    await userEvent.click(await screen.findByText(/Arsenal vs Chelsea/));
    await userEvent.click(await screen.findByText('Match Result'));

    expect(await screen.findByText('Overridden')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/odds-overrides/override-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
