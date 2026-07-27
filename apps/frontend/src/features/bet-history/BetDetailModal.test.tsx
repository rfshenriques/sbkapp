import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../auth/authStore';
import type { PlacedBet } from '../../lib/backendApi';
import { BetDetailModal } from './BetDetailModal';
import { useBetDetailModalStore } from './betDetailModalStore';

function buildBet(overrides: Partial<PlacedBet> = {}): PlacedBet {
  return {
    id: 'bet-1',
    stakeCents: 1000,
    combinedOdds: '2.00',
    potentialPayoutCents: 2000,
    status: 'WON',
    settledPayoutCents: 2000,
    settledAt: '2026-07-19T12:00:00Z',
    createdAt: '2026-07-19T10:00:00Z',
    fundedByFreebets: false,
    insuranceCostPercent: 0,
    accaBoostPercent: 0,
    betAndGetCampaignName: null,
    betAndGetCampaignRewardCents: null,
    depositCampaignName: null,
    depositCampaignRewardCents: null,
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
        status: 'WON',
      },
    ],
    ...overrides,
  };
}

function renderModal() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <BetDetailModal />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useAuthStore.setState({ accessToken: 'header.payload.signature', user: null, isInitialized: true });
});

afterEach(() => {
  useBetDetailModalStore.setState({ betId: null });
  vi.unstubAllGlobals();
});

describe('BetDetailModal', () => {
  it('renders nothing when no bet is selected', () => {
    renderModal();
    expect(screen.queryByText('Bet details')).not.toBeInTheDocument();
  });

  it('renders the full receipt for the selected bet once it loads', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([buildBet()]), { status: 200 })));
    useBetDetailModalStore.setState({ betId: 'bet-1' });

    renderModal();

    expect(await screen.findByText('Bet details')).toBeInTheDocument();
    expect(screen.getByText('Arsenal')).toBeInTheDocument();
    expect(screen.getByText('Chelsea')).toBeInTheDocument();
    expect(screen.getByText('Payout')).toBeInTheDocument();
    expect(screen.getByText('€20.00')).toBeInTheDocument();
  });

  it('closes when the close button is clicked', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([buildBet()]), { status: 200 })));
    useBetDetailModalStore.setState({ betId: 'bet-1' });

    renderModal();
    await screen.findByText('Bet details');

    const closeButtons = screen.getAllByRole('button', { name: 'Close bet details' });
    await userEvent.click(closeButtons[closeButtons.length - 1]!);

    expect(useBetDetailModalStore.getState().betId).toBeNull();
  });
});
