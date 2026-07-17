import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStaffAuthStore } from '../features/auth/staffAuthStore';
import type { Bet } from '../lib/backendApi';
import SettlementPage from './SettlementPage';

const pendingBet: Bet = {
  id: 'bet-1',
  userId: 'user-1',
  stakeCents: 1_000,
  combinedOdds: '2.1',
  potentialPayoutCents: 2_100,
  status: 'PENDING',
  createdAt: '2026-07-17T00:00:00Z',
  settledPayoutCents: null,
  settledAt: null,
  user: { id: 'user-1', username: 'bettor_bob', email: 'bettor@example.com' },
  selections: [
    {
      id: 'sel-1',
      betId: 'bet-1',
      matchId: 'match-1',
      marketId: 'match-result',
      selectionId: 'home',
      matchLabel: 'Arsenal vs Chelsea',
      marketName: 'Match Result',
      selectionName: 'Home',
      odds: '2.10',
      status: 'OPEN',
    },
  ],
};

function renderSettlementPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <SettlementPage />
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

describe('SettlementPage', () => {
  it('lists pending bets with their selections', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify([pendingBet]), { status: 200 })),
    );

    renderSettlementPage();

    expect(await screen.findByText('bettor_bob')).toBeInTheDocument();
    expect(screen.getByText('Arsenal vs Chelsea')).toBeInTheDocument();
    expect(screen.getByText(/Match Result: Home/)).toBeInTheDocument();
  });

  it('settling a selection sends the right PATCH request and refetches the list', async () => {
    const settledBet: Bet = {
      ...pendingBet,
      status: 'WON',
      settledPayoutCents: 2_100,
      settledAt: '2026-07-17T00:05:00Z',
      selections: [{ ...pendingBet.selections[0]!, status: 'WON' }],
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'PATCH' && url === '/backend/admin/bets/bet-1/selections/sel-1/settlement') {
        expect(JSON.parse(init!.body as string)).toEqual({ status: 'WON' });
        return new Response(JSON.stringify(settledBet), { status: 200 });
      }
      if (method === 'GET' && url.startsWith('/backend/admin/bets')) {
        return new Response(JSON.stringify([pendingBet]), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderSettlementPage();

    await screen.findByText('bettor_bob');

    const wonButtons = screen.getAllByRole('button', { name: 'WON' });
    // The first WON button is the selection-row action (not the filter tab).
    await userEvent.click(wonButtons[1]!);

    expect(
      fetchMock.mock.calls.some(([input, init]) => {
        const url = typeof input === 'string' ? input : input.toString();
        return (
          url === '/backend/admin/bets/bet-1/selections/sel-1/settlement' &&
          init?.method === 'PATCH'
        );
      }),
    ).toBe(true);
  });

  it('shows an empty state when there are no bets for the selected filter', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 })),
    );

    renderSettlementPage();

    expect(await screen.findByText('No pending bets.')).toBeInTheDocument();
  });
});
