import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlayerDetail } from '../lib/backendApi';
import PlayerDetailPage from './PlayerDetailPage';

const player: PlayerDetail = {
  id: 'player-1',
  email: 'alice@example.com',
  username: 'alice',
  phone: '+15551234567',
  phoneVerifiedAt: '2026-06-01T00:00:00.000Z',
  createdAt: '2026-05-01T00:00:00.000Z',
  balanceCents: 50_000,
  freebetsCents: 1_000,
  segments: [{ id: 'segment-1', name: 'VIP', colorHex: null }],
  stats: {
    turnoverCents: 200_000,
    betCount: 10,
    avgStakeCents: 20_000,
    ggrCents: 15_000,
    openLiabilityCents: 7_500,
    avgSelectionsPerBet: 2.5,
    singleBetCount: 4,
    accumulatorBetCount: 6,
    topSports: [{ sport: 'Football', count: 7 }],
    topCompetitions: [{ competition: 'Premier League', count: 5 }],
  },
  recentBets: [
    {
      id: 'bet-11111111-aaaa',
      stakeCents: 5_000,
      combinedOdds: '2.5000',
      potentialPayoutCents: 12_500,
      settledPayoutCents: null,
      status: 'PENDING',
      createdAt: '2026-08-01T00:00:00.000Z',
      fundedByFreebets: false,
      insuranceCostPercent: 0,
      accaBoostPercent: 0,
      campaignName: null,
      selections: [
        {
          matchLabel: 'Arsenal vs Chelsea',
          marketName: 'Match Result',
          selectionName: 'Home',
          odds: '2.50',
          status: 'OPEN',
        },
      ],
    },
    {
      id: 'bet-22222222-bbbb',
      stakeCents: 5_000,
      combinedOdds: '2.0000',
      potentialPayoutCents: 10_000,
      settledPayoutCents: 10_000,
      status: 'WON',
      createdAt: '2026-08-02T00:00:00.000Z',
      fundedByFreebets: false,
      insuranceCostPercent: 0,
      accaBoostPercent: 0,
      campaignName: null,
      selections: [
        {
          matchLabel: 'Liverpool vs Man City',
          marketName: 'Match Result',
          selectionName: 'Home',
          odds: '2.00',
          status: 'WON',
        },
      ],
    },
    {
      id: 'bet-33333333-cccc',
      stakeCents: 5_000,
      combinedOdds: '3.0000',
      potentialPayoutCents: 15_000,
      settledPayoutCents: 0,
      status: 'LOST',
      createdAt: '2026-08-03T00:00:00.000Z',
      fundedByFreebets: false,
      insuranceCostPercent: 0,
      accaBoostPercent: 0,
      campaignName: null,
      selections: [
        {
          matchLabel: 'Real Madrid vs Barcelona',
          marketName: 'Match Result',
          selectionName: 'Away',
          odds: '3.00',
          status: 'LOST',
        },
      ],
    },
  ],
  deposits: [{ id: 'deposit-1', amountCents: 10_000, createdAt: '2026-07-15T00:00:00.000Z' }],
  webauthnCredentialCount: 1,
  pushSubscriptionCount: 2,
};

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/players/player-1']}>
        <Routes>
          <Route path="/players/:id" element={<PlayerDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PlayerDetailPage', () => {
  it('shows turnover, GGR, open liability, and preference KPIs', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(player), { status: 200 })));

    renderPage();

    expect(await screen.findByText('2000.00')).toBeInTheDocument(); // turnover
    expect(screen.getByText('150.00')).toBeInTheDocument(); // GGR
    expect(screen.getByText('75.00')).toBeInTheDocument(); // open liability
    expect(screen.getByText('4 singles · 6 accas')).toBeInTheDocument();
    expect(screen.getByText(/Football/)).toBeInTheDocument();
    expect(screen.getByText(/Premier League/)).toBeInTheDocument();
  });

  it('colors payout, GGR, and status per bet based on outcome - open grey, won green, lost red', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(player), { status: 200 })));

    renderPage();
    await screen.findByRole('button', { name: '#bet-1111' });

    // PENDING: payout is the potential payout (125.00), GGR undetermined, both grey.
    expect(screen.getByText('125.00').closest('td')).toHaveClass('text-text-muted');
    const pendingRow = screen.getByRole('button', { name: '#bet-1111' }).closest('tr')!;
    expect(within(pendingRow).getByText('—')).toHaveClass('text-text-muted');
    expect(within(pendingRow).getByText('PENDING')).toHaveClass('text-text-muted');

    // WON: settled payout 100.00, GGR = 50 - 100 = -50.00 (house paid out more than staked) -> red.
    const wonRow = screen.getByRole('button', { name: '#bet-2222' }).closest('tr')!;
    expect(within(wonRow).getByText('100.00')).not.toHaveClass('text-text-muted');
    expect(within(wonRow).getByText('-50.00')).toHaveClass('text-danger');
    expect(within(wonRow).getByText('WON')).toHaveClass('text-brand');

    // LOST: settled payout 0.00, GGR = 50 - 0 = 50.00 (house kept the stake) -> green (brand).
    const lostRow = screen.getByRole('button', { name: '#bet-3333' }).closest('tr')!;
    expect(within(lostRow).getByText('0.00')).not.toHaveClass('text-brand');
    expect(lostRow.querySelector('td.text-brand')).toHaveTextContent('50.00');
    expect(within(lostRow).getByText('LOST')).toHaveClass('text-danger');
  });

  it('colors each selection inside the ticket panel by its own outcome', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(player), { status: 200 })));

    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: '#bet-2222' }));
    const wonSelection = screen.getByText('Liverpool vs Man City').closest('li')!;
    expect(within(wonSelection).getByText('WON')).toHaveClass('text-brand');

    await userEvent.click(screen.getAllByRole('button', { name: 'Close panel' })[0]!);
    await userEvent.click(screen.getByRole('button', { name: '#bet-3333' }));
    const lostSelection = screen.getByText('Real Madrid vs Barcelona').closest('li')!;
    expect(within(lostSelection).getByText('LOST')).toHaveClass('text-danger');
  });

  it('opens a side panel with the full ticket when a bet reference is clicked, closes on request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(player), { status: 200 })));

    renderPage();

    const ticketButton = await screen.findByRole('button', { name: '#bet-1111' });
    expect(screen.queryByText('Arsenal vs Chelsea')).not.toBeInTheDocument();

    await userEvent.click(ticketButton);
    expect(screen.getByText('Arsenal vs Chelsea')).toBeInTheDocument();
    expect(screen.getByText('Match Result: Home')).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', { name: 'Close panel' })[0]!);
    expect(screen.queryByText('Arsenal vs Chelsea')).not.toBeInTheDocument();
  });
});
