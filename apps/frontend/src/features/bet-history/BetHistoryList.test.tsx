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
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Match Result')).toBeInTheDocument();
    expect(screen.getByText('OPEN')).toBeInTheDocument();
    expect(screen.getByText('Potential payout')).toBeInTheDocument();
    expect(screen.getByText('€20.00')).toBeInTheDocument();
  });

  it('shows the settled payout instead of "potential" for a settled bet', async () => {
    const settledBet = buildBet({ status: 'WON', settledPayoutCents: 1950 });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify([settledBet]), { status: 200 })),
    );

    renderList();

    expect(await screen.findByText('Payout')).toBeInTheDocument();
    expect(screen.getByText('€19.50')).toBeInTheDocument();
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

  it('shows the freebet icon next to the stake for a freebet-funded bet, not a text tag', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify([buildBet({ fundedByFreebets: true })]), { status: 200 })),
    );

    renderList();

    expect(await screen.findByRole('img', { name: 'Funded by freebet' })).toBeInTheDocument();
    expect(screen.queryByText('Freebet')).not.toBeInTheDocument();
  });

  it('shares a rendered bet image via the Web Share API when Share is clicked', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify([buildBet({ status: 'WON', settledPayoutCents: 2000 })]), { status: 200 })),
    );
    const fakeContext = {
      scale: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arcTo: vi.fn(),
      arc: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: 40 })),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '',
      textAlign: 'left',
      textBaseline: 'alphabetic',
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeContext as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      callback: BlobCallback,
    ) {
      callback(new Blob(['fake-png'], { type: 'image/png' }));
    });
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', { ...navigator, share, canShare });

    renderList();
    await userEvent.click(await screen.findByRole('button', { name: /share/i }));

    expect(share).toHaveBeenCalledWith(expect.objectContaining({ files: expect.any(Array) }));
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

    expect(await screen.findByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Arsenal vs Chelsea')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /show selections/i })).not.toBeInTheDocument();
  });

  it('toggles an accumulator\'s per-selection detail via the Show/Hide selections control', async () => {
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
    // The leg list animates open/closed (see the grid-rows trick in
    // BetHistoryList) rather than mounting/unmounting, so it's always in the
    // document - collapsed state is asserted via aria-expanded instead of
    // absence from the DOM.
    expect(screen.getByRole('button', { name: 'Show selections' })).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(screen.getByRole('button', { name: 'Show selections' }));

    expect(screen.getByRole('button', { name: 'Hide selections' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Arsenal vs Chelsea')).toBeInTheDocument();
    expect(screen.getByText('Away')).toBeInTheDocument();
    expect(screen.getByText('Liverpool vs Man City')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Hide selections' }));

    expect(screen.getByRole('button', { name: 'Show selections' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows which campaign a bet qualified for, and its reward amount', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([buildBet({ betAndGetCampaignName: 'CL Bet & Get', betAndGetCampaignRewardCents: 1000 })]),
          { status: 200 },
        ),
      ),
    );

    renderList();

    expect(await screen.findByText('Qualified for CL Bet & Get - €10.00 freebet')).toBeInTheDocument();
  });

  it('shows both a Bet & Get and a deposit campaign qualification at once', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([
            buildBet({
              betAndGetCampaignName: 'CL Bet & Get',
              betAndGetCampaignRewardCents: 1000,
              depositCampaignName: 'Welcome Deposit Bonus',
              depositCampaignRewardCents: 2500,
            }),
          ]),
          { status: 200 },
        ),
      ),
    );

    renderList();

    expect(await screen.findByText('Qualified for CL Bet & Get - €10.00 freebet')).toBeInTheDocument();
    expect(await screen.findByText('Qualified for Welcome Deposit Bonus - €25.00 freebet')).toBeInTheDocument();
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
