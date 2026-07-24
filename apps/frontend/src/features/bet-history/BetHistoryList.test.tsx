import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../auth/authStore';
import { useAuthModalStore } from '../auth/authModalStore';
import type { PlacedBet } from '../../lib/backendApi';
import { BetHistoryList } from './BetHistoryList';

function buildBet(overrides: Partial<PlacedBet> = {}): PlacedBet {
  return {
    id: 'bet-1',
    stakeCents: 1000,
    combinedOdds: '2.00',
    potentialPayoutCents: 2000,
    status: 'PENDING',
    settledPayoutCents: null,
    settledAt: null,
    createdAt: '2026-07-19T10:00:00Z',
    selections: [
      {
        id: 'sel-1',
        matchId: 'match-1',
        marketId: 'match-result',
        selectionId: 'home',
        matchLabel: 'Arsenal vs Chelsea',
        marketName: 'Match Result',
        selectionName: 'Home',
        odds: '2.00',
        status: 'OPEN',
      },
    ],
    ...overrides,
  };
}

function renderList() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <BetHistoryList />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useAuthStore.setState({ accessToken: 'header.payload.signature', user: null, isInitialized: true });
  useAuthModalStore.setState({ mode: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('BetHistoryList', () => {
  it('prompts to log in when not authenticated, instead of loading forever', async () => {
    useAuthStore.setState({ accessToken: null, user: null, isInitialized: true });

    renderList();

    expect(screen.queryByRole('status', { name: 'Loading bet history' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(useAuthModalStore.getState().mode).toBe('login');
  });

  it('shows an empty state when there are no bets', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 })));

    renderList();

    expect(await screen.findByText('No bets placed yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse matches' })).toHaveAttribute('href', '/');
  });

  it('shows a bet with its selection and potential payout when pending', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify([buildBet()]), { status: 200 })),
    );

    renderList();

    expect(await screen.findByText('Arsenal vs Chelsea')).toBeInTheDocument();
    expect(screen.getByText(/Match Result: Home/)).toBeInTheDocument();
    expect(screen.getByText('PENDING')).toBeInTheDocument();
    expect(screen.getByText('Potential 20.00')).toBeInTheDocument();
  });

  it('shows the settled payout instead of "potential" for a settled bet', async () => {
    const settledBet = buildBet({ status: 'WON', settledPayoutCents: 1950 });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify([settledBet]), { status: 200 })),
    );

    renderList();

    expect(await screen.findByText('Payout 19.50')).toBeInTheDocument();
  });

  it('lists open bets before settled ones', async () => {
    const bets = [
      buildBet({ id: 'settled', status: 'WON', createdAt: '2026-07-19T12:00:00Z', settledPayoutCents: 1950 }),
      buildBet({ id: 'open', status: 'PENDING', createdAt: '2026-07-18T09:00:00Z' }),
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(bets), { status: 200 })));

    renderList();

    const statuses = await screen.findAllByText(/PENDING|WON/);
    expect(statuses.map((el) => el.textContent)).toEqual(['PENDING', 'WON']);
  });
});
