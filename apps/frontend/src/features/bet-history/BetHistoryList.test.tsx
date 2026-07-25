import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../auth/authStore';
import { useAuthModalStore } from '../auth/authModalStore';
import type { PlacedBet } from '../../lib/backendApi';
import { BetHistoryList, type BetHistoryFilter } from './BetHistoryList';

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

function renderList(filter?: BetHistoryFilter) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <BetHistoryList filter={filter} />
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
    expect(screen.getByText('OPEN')).toBeInTheDocument();
    expect(screen.getByText('Potential €20.00')).toBeInTheDocument();
  });

  it('shows the settled payout instead of "potential" for a settled bet', async () => {
    const settledBet = buildBet({ status: 'WON', settledPayoutCents: 1950 });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify([settledBet]), { status: 200 })),
    );

    renderList();

    expect(await screen.findByText('Payout €19.50')).toBeInTheDocument();
  });

  it('lists open bets before settled ones', async () => {
    const bets = [
      buildBet({ id: 'settled', status: 'WON', createdAt: '2026-07-19T12:00:00Z', settledPayoutCents: 1950 }),
      buildBet({ id: 'open', status: 'PENDING', createdAt: '2026-07-18T09:00:00Z' }),
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(bets), { status: 200 })));

    renderList();

    const statuses = await screen.findAllByText(/OPEN|WON/);
    expect(statuses.map((el) => el.textContent)).toEqual(['OPEN', 'WON']);
  });

  it('labels a single-selection bet "Single" and an accumulator "Accumulator (N)"', async () => {
    const accaBet = buildBet({
      id: 'acca',
      selections: [
        ...buildBet().selections,
        {
          id: 'sel-2',
          matchId: 'match-2',
          marketId: 'match-result',
          selectionId: 'away',
          matchLabel: 'Liverpool vs Man City',
          marketName: 'Match Result',
          selectionName: 'Away',
          odds: '3.00',
          status: 'OPEN',
        },
      ],
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([accaBet]), { status: 200 })));

    renderList();

    expect(await screen.findByText('Accumulator (2)')).toBeInTheDocument();
  });

  it('shows a Freebet tag for a freebet-funded bet', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify([buildBet({ fundedByFreebets: true })]), { status: 200 })),
    );

    renderList();

    expect(await screen.findByText('Freebet')).toBeInTheDocument();
  });

  it('shows the pre-insurance payout struck through next to the insured one', async () => {
    const insuredBet = buildBet({ insuranceCostPercent: 10, potentialPayoutCents: 1800 });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify([insuredBet]), { status: 200 })),
    );

    renderList();

    expect(await screen.findByText('Insured')).toBeInTheDocument();
    expect(screen.getByText('€20.00')).toBeInTheDocument();
    expect(screen.getByText('€18.00')).toBeInTheDocument();
  });

  it('shows the unboosted combined odds struck through next to the boosted one for a boosted accumulator', async () => {
    const boostedBet = buildBet({
      id: 'boosted',
      combinedOdds: '6.60',
      accaBoostPercent: 10,
      selections: [
        ...buildBet().selections,
        {
          id: 'sel-2',
          matchId: 'match-2',
          marketId: 'match-result',
          selectionId: 'away',
          matchLabel: 'Liverpool vs Man City',
          marketName: 'Match Result',
          selectionName: 'Away',
          odds: '3.00',
          status: 'OPEN',
        },
      ],
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([boostedBet]), { status: 200 })));

    renderList();

    expect(await screen.findByText('Boosted +10%')).toBeInTheDocument();
    expect(screen.getByText(/6\.00/)).toBeInTheDocument();
    expect(screen.getByText(/6\.60/)).toBeInTheDocument();
  });

  it('keeps a single bet\'s selection always visible with no expand control', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([buildBet()]), { status: 200 })));

    renderList();

    expect(await screen.findByText('Arsenal vs Chelsea')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /show selections/i })).not.toBeInTheDocument();
  });

  it('collapses an accumulator by default, hiding per-selection detail until expanded', async () => {
    const accaBet = buildBet({
      id: 'acca',
      selections: [
        ...buildBet().selections,
        {
          id: 'sel-2',
          matchId: 'match-2',
          marketId: 'match-result',
          selectionId: 'away',
          matchLabel: 'Liverpool vs Man City',
          marketName: 'Match Result',
          selectionName: 'Away',
          odds: '3.00',
          status: 'OPEN',
        },
      ],
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([accaBet]), { status: 200 })));

    renderList();

    expect(await screen.findByText('Accumulator (2)')).toBeInTheDocument();
    expect(screen.queryByText('Arsenal vs Chelsea')).not.toBeInTheDocument();
    expect(screen.queryByText('Liverpool vs Man City')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Show selections' }));

    expect(screen.getByText('Arsenal vs Chelsea')).toBeInTheDocument();
    expect(screen.getByText('Liverpool vs Man City')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Hide selections' }));

    expect(screen.queryByText('Arsenal vs Chelsea')).not.toBeInTheDocument();
  });

  it('shows which campaign a bet qualified for', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify([buildBet({ betAndGetCampaignName: 'CL Bet & Get' })]), { status: 200 }),
      ),
    );

    renderList();

    expect(await screen.findByText('Qualified for CL Bet & Get')).toBeInTheDocument();
  });

  it('shows the acca rollback refund amount', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify([buildBet({ status: 'LOST', accaRollbackRewardCents: 500 })]), { status: 200 }),
      ),
    );

    renderList();

    expect(await screen.findByText('€5.00 refunded as a freebet (Acca Rollback)')).toBeInTheDocument();
  });

  describe('filter', () => {
    const bets = [
      buildBet({ id: 'open', status: 'PENDING' }),
      buildBet({ id: 'won', status: 'WON', settledPayoutCents: 2000 }),
      buildBet({ id: 'lost', status: 'LOST', settledPayoutCents: 0 }),
    ];

    it('OPEN shows only PENDING bets', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(bets), { status: 200 })));
      renderList('OPEN');
      expect(await screen.findByText('OPEN')).toBeInTheDocument();
      expect(screen.queryByText('WON')).not.toBeInTheDocument();
      expect(screen.queryByText('LOST')).not.toBeInTheDocument();
    });

    it('WON shows only WON bets', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(bets), { status: 200 })));
      renderList('WON');
      expect(await screen.findByText('WON')).toBeInTheDocument();
      expect(screen.queryByText('OPEN')).not.toBeInTheDocument();
      expect(screen.queryByText('LOST')).not.toBeInTheDocument();
    });

    it('FINISHED shows every settled bet (WON and LOST), not just wins', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(bets), { status: 200 })));
      renderList('FINISHED');
      expect(await screen.findByText('WON')).toBeInTheDocument();
      expect(screen.getByText('LOST')).toBeInTheDocument();
      expect(screen.queryByText('OPEN')).not.toBeInTheDocument();
    });

    it('shows a filter-specific empty state when nothing matches', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response(JSON.stringify([buildBet({ status: 'WON' })]), { status: 200 })),
      );
      renderList('OPEN');
      expect(await screen.findByText('No open bets')).toBeInTheDocument();
    });
  });
});
