import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../features/auth/authStore';
import type { PlacedBet } from '../lib/backendApi';
import MyBetsPage from './MyBetsPage';

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
    fundedByFreebets: false,
    insuranceCostPercent: 0,
    accaBoostPercent: 0,
    betAndGetCampaignName: null,
    depositCampaignName: null,
    accaRollbackRewardCents: null,
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

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MyBetsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MyBetsPage', () => {
  it('prompts to log in when not authenticated', () => {
    useAuthStore.setState({ accessToken: null, user: null, isInitialized: true });
    renderPage();

    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
  });

  it('shows the bet history when authenticated', async () => {
    useAuthStore.setState({
      accessToken: 'header.payload.signature',
      user: null,
      isInitialized: true,
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 })));

    renderPage();

    expect(await screen.findByText('No bets placed yet')).toBeInTheDocument();
  });

  it('defaults to the Open tab and switches to Won/Finished on click', async () => {
    useAuthStore.setState({
      accessToken: 'header.payload.signature',
      user: null,
      isInitialized: true,
    });
    const bets = [
      buildBet({ id: 'open', status: 'PENDING' }),
      buildBet({ id: 'won', status: 'WON', settledPayoutCents: 2000 }),
      buildBet({ id: 'lost', status: 'LOST', settledPayoutCents: 0 }),
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(bets), { status: 200 })));

    renderPage();

    expect(screen.getByRole('tab', { name: 'Open' })).toHaveAttribute('aria-selected', 'true');
    await screen.findByText('OPEN');
    expect(screen.queryByText('WON')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Won' }));
    expect(await screen.findByText('WON')).toBeInTheDocument();
    expect(screen.queryByText('OPEN')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Finished' }));
    expect(await screen.findByText('WON')).toBeInTheDocument();
    expect(screen.getByText('LOST')).toBeInTheDocument();
    expect(screen.queryByText('OPEN')).not.toBeInTheDocument();
  });
});
