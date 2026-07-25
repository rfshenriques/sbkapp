import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStaffAuthStore } from '../features/auth/staffAuthStore';
import type { Bet } from '../lib/backendApi';
import BetHistoryReportPage from './BetHistoryReportPage';

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
  fundedByFreebets: false,
  insuranceCostPercent: 0,
  accaBoostPercent: 0,
  betAndGetCampaignName: null,
  depositCampaignName: null,
  accaRollbackRewardCents: null,
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
      sport: 'Football',
      competition: 'Premier League',
    },
  ],
};

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <BetHistoryReportPage />
    </QueryClientProvider>,
  );
}

function stubFetch(bets: Bet[] = [pendingBet], filterOptions = { sports: ['Football'], competitions: ['Premier League'] }) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/admin/bets/filter-options')) {
      return new Response(JSON.stringify(filterOptions), { status: 200 });
    }
    if (url.includes('/admin/bets')) {
      return new Response(JSON.stringify(bets), { status: 200 });
    }
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  useStaffAuthStore.setState({
    accessToken: 'header.payload.signature',
    user: { sub: 'staff-1', username: 'admin_bob', role: 'ADMIN' },
    isInitialized: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('BetHistoryReportPage', () => {
  it('lists bets with their selections and a read-only status badge (no settle buttons)', async () => {
    stubFetch();
    renderPage();

    expect(await screen.findByText('Arsenal vs Chelsea')).toBeInTheDocument();
    expect(screen.getByText(/Match Result: Home/)).toBeInTheDocument();
    // Only the page-level status filter tab, not a per-selection settle button.
    expect(screen.getAllByRole('button', { name: 'WON' })).toHaveLength(1);
  });

  it('shows an empty state when no bets match the filters', async () => {
    stubFetch([]);
    renderPage();

    expect(await screen.findByText('No bets match these filters.')).toBeInTheDocument();
  });

  it('re-fetches with the status filter when a status tab is clicked', async () => {
    const fetchMock = stubFetch();
    renderPage();
    await screen.findByText('Arsenal vs Chelsea');

    await userEvent.click(screen.getByRole('button', { name: 'WON' }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([input]) => {
        const url = typeof input === 'string' ? input : (input as URL).toString();
        return url.includes('/admin/bets?') && url.includes('status=WON');
      });
      expect(call).toBeDefined();
    });
  });

  it('re-fetches with the player search term', async () => {
    const fetchMock = stubFetch();
    renderPage();
    await screen.findByText('Arsenal vs Chelsea');

    await userEvent.type(screen.getByLabelText('Player (username or email)'), 'bettor_bob');

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([input]) => {
        const url = typeof input === 'string' ? input : (input as URL).toString();
        return url.includes('player=bettor_bob');
      });
      expect(call).toBeDefined();
    });
  });

  it('populates sport/competition dropdowns from real filter-option data and re-fetches on selection', async () => {
    const fetchMock = stubFetch();
    renderPage();
    await screen.findByText('Arsenal vs Chelsea');

    const sportSelect = await screen.findByLabelText('Sport');
    expect(screen.getByRole('option', { name: 'Football' })).toBeInTheDocument();

    await userEvent.selectOptions(sportSelect, 'Football');

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([input]) => {
        const url = typeof input === 'string' ? input : (input as URL).toString();
        return url.includes('sport=Football');
      });
      expect(call).toBeDefined();
    });
  });

  it('re-fetches with the freebet-funded toggle', async () => {
    const fetchMock = stubFetch();
    renderPage();
    await screen.findByText('Arsenal vs Chelsea');

    await userEvent.click(screen.getByLabelText('Freebet-funded'));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([input]) => {
        const url = typeof input === 'string' ? input : (input as URL).toString();
        return url.includes('fundedByFreebets=true');
      });
      expect(call).toBeDefined();
    });
  });

  it('resets all filters back to defaults', async () => {
    const fetchMock = stubFetch();
    renderPage();
    await screen.findByText('Arsenal vs Chelsea');

    await userEvent.type(screen.getByLabelText('Player (username or email)'), 'someone');
    await userEvent.click(screen.getByLabelText('Insured'));
    await userEvent.click(screen.getByRole('button', { name: 'Reset filters' }));

    expect(screen.getByLabelText('Player (username or email)')).toHaveValue('');
    expect(screen.getByLabelText('Insured')).not.toBeChecked();
    await waitFor(() => {
      const lastCall = fetchMock.mock.calls.at(-1);
      const url = typeof lastCall?.[0] === 'string' ? lastCall[0] : (lastCall?.[0] as URL)?.toString();
      expect(url).not.toContain('player=');
      expect(url).not.toContain('insured=');
    });
  });
});
