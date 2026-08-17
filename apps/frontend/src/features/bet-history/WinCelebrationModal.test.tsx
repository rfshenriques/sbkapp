import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../auth/authStore';
import type { PlacedBet } from '../../lib/backendApi';
import { WinCelebrationModal } from './WinCelebrationModal';
import { useWinCelebrationStore } from './winCelebrationStore';

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
    registerCampaignName: null,
    registerCampaignRewardCents: null,
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
      <WinCelebrationModal />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useAuthStore.setState({ accessToken: 'header.payload.signature', user: null, isInitialized: true });
});

afterEach(() => {
  useWinCelebrationStore.setState({ betId: null });
  vi.unstubAllGlobals();
});

describe('WinCelebrationModal', () => {
  it('renders nothing when no bet is selected', () => {
    renderModal();
    expect(screen.queryByText('Congratulations!')).not.toBeInTheDocument();
  });

  it('shows the congratulations step with the settled payout amount first', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([buildBet()]), { status: 200 })));
    useWinCelebrationStore.setState({ betId: 'bet-1' });

    renderModal();

    expect(await screen.findByText('Congratulations!')).toBeInTheDocument();
    expect(screen.getByText('20.00 €')).toBeInTheDocument();
    expect(screen.queryByText('Arsenal vs Chelsea')).not.toBeInTheDocument();
  });

  it('advances to the bet receipt when "See bet" is clicked', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([buildBet()]), { status: 200 })));
    useWinCelebrationStore.setState({ betId: 'bet-1' });

    renderModal();
    await screen.findByText('Congratulations!');
    await userEvent.click(screen.getByRole('button', { name: 'See bet' }));

    expect(screen.getByText('Arsenal')).toBeInTheDocument();
    expect(screen.getByText('Chelsea')).toBeInTheDocument();
    expect(screen.queryByText('Congratulations!')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
  });

  it('closes when Done is clicked on the bet receipt step', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([buildBet()]), { status: 200 })));
    useWinCelebrationStore.setState({ betId: 'bet-1' });

    renderModal();
    await screen.findByText('Congratulations!');
    await userEvent.click(screen.getByRole('button', { name: 'See bet' }));
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(useWinCelebrationStore.getState().betId).toBeNull();
  });
});
