import type { Match } from '@sportsbook/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStaffAuthStore } from '../features/auth/staffAuthStore';
import type { CompetitionSuspension, MarketSuspension } from '../lib/backendApi';
import TradingPage from './TradingPage';

const liveMatch: Match = {
  id: 'match-1',
  sport: 'Football',
  country: 'England',
  competition: 'Premier League',
  homeTeam: 'Arsenal',
  awayTeam: 'Chelsea',
  kickoff: '2026-07-18T15:00:00Z',
  isLive: false,
  markets: [
    {
      id: 'match-result',
      name: 'Match Result',
      selections: [{ id: 'home', name: 'Arsenal', odds: 2.1 }],
    },
  ],
};

function renderTradingPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <TradingPage />
    </QueryClientProvider>,
  );
}

function stubFetch({
  marketSuspensions = [],
  competitionSuspensions = [],
}: {
  marketSuspensions?: MarketSuspension[];
  competitionSuspensions?: CompetitionSuspension[];
} = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method ?? 'GET';

    if (method === 'GET' && url === '/api/events') {
      return new Response(JSON.stringify([liveMatch]), { status: 200 });
    }
    if (method === 'GET' && url === '/backend/admin/market-suspensions') {
      return new Response(JSON.stringify(marketSuspensions), { status: 200 });
    }
    if (method === 'GET' && url === '/backend/admin/competition-suspensions') {
      return new Response(JSON.stringify(competitionSuspensions), { status: 200 });
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

describe('TradingPage', () => {
  it('drills into sport > country > league to reach a match on the Matches & markets tab', async () => {
    stubFetch();
    renderTradingPage();

    expect(screen.queryByText(/Arsenal vs Chelsea/)).not.toBeInTheDocument();

    await userEvent.click(await screen.findByRole('button', { name: /Football/ }));
    await userEvent.click(screen.getByRole('button', { name: /England/ }));
    await userEvent.click(screen.getByRole('button', { name: /Premier League/ }));

    expect(await screen.findByText(/Arsenal vs Chelsea/)).toBeInTheDocument();
  });

  it('suspends a match from the drilled-down row', async () => {
    const fetchMock = stubFetch();
    renderTradingPage();

    await userEvent.click(await screen.findByRole('button', { name: /Football/ }));
    await userEvent.click(screen.getByRole('button', { name: /England/ }));
    await userEvent.click(screen.getByRole('button', { name: /Premier League/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Suspend match' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/market-suspensions',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('switches to the Whole competitions tab and drills into sport > country to list competitions', async () => {
    stubFetch();
    renderTradingPage();

    await userEvent.click(screen.getByRole('button', { name: 'Whole competitions' }));
    expect(screen.queryByText('Premier League')).not.toBeInTheDocument();

    await userEvent.click(await screen.findByRole('button', { name: /Football/ }));
    await userEvent.click(screen.getByRole('button', { name: /England/ }));

    expect(await screen.findByText('Premier League')).toBeInTheDocument();
  });
});
