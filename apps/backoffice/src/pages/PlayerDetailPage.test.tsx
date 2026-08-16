import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
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
  it('shows turnover, GGR, and preference KPIs', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(player), { status: 200 })));

    renderPage();

    expect(await screen.findByText('2000.00')).toBeInTheDocument(); // turnover
    expect(screen.getByText('150.00')).toBeInTheDocument(); // GGR
    expect(screen.getByText('4 singles · 6 accas')).toBeInTheDocument();
    expect(screen.getByText(/Football/)).toBeInTheDocument();
    expect(screen.getByText(/Premier League/)).toBeInTheDocument();
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
