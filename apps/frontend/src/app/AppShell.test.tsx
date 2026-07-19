import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../features/auth/authStore';
import { useBetSlipStore } from '../features/bet-slip/betSlipStore';
import { AppShell } from './AppShell';

function renderShell() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route index element={<div>Page content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const homeSelection = {
  matchId: 'match-1',
  marketId: 'match-result',
  selectionId: 'home',
  matchLabel: 'Arsenal vs Chelsea',
  marketName: 'Match Result',
  selectionName: 'Home',
  odds: 2.1,
};

const awaySelection = {
  matchId: 'match-2',
  marketId: 'match-result',
  selectionId: 'away',
  matchLabel: 'Liverpool vs Manchester City',
  marketName: 'Match Result',
  selectionName: 'Away',
  odds: 2.5,
};

beforeEach(() => {
  useBetSlipStore.setState({ selections: [] });
  useAuthStore.setState({ accessToken: null, user: null, isInitialized: false });
  // Not logged in by default - the silent-refresh call on mount finds no session.
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AppShell', () => {
  it('always renders the bet slip panel (desktop persistent panel), even when empty', () => {
    renderShell();

    // Desktop's persistent panel uses the fuller, promotional empty state.
    expect(screen.getByText('Add selections to your bet slip')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse matches' })).toBeInTheDocument();
  });

  it('the desktop panel shows a Bet Slip / History tab pair', () => {
    renderShell();

    expect(screen.getByRole('tab', { name: 'Bet Slip' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'History' })).toBeInTheDocument();
  });

  it('has a My Bets link in the mobile bottom nav', () => {
    renderShell();

    expect(screen.getByRole('link', { name: 'My Bets' })).toHaveAttribute('href', '/my-bets');
  });

  it('does not show the mobile floating bar when the slip is empty', () => {
    renderShell();

    expect(screen.queryByText(/Single ·|Accumulator ·/)).not.toBeInTheDocument();
  });

  it('the mobile floating bar reads "Single" with that one odd for exactly one selection', () => {
    useBetSlipStore.setState({ selections: [homeSelection] });
    renderShell();

    expect(screen.getByText('Single · 2.10')).toBeInTheDocument();
  });

  it('the mobile floating bar reads "Accumulator" with the combined odds for 2+ selections', () => {
    useBetSlipStore.setState({ selections: [homeSelection, awaySelection] });
    renderShell();

    // 2.1 * 2.5 = 5.25
    expect(screen.getByText('Accumulator · 5.25')).toBeInTheDocument();
  });

  it('clicking the mobile floating bar opens the drawer', async () => {
    useBetSlipStore.setState({ selections: [homeSelection] });
    renderShell();

    await userEvent.click(screen.getByText('Single · 2.10'));

    // Two elements share this label: the backdrop and the drawer's own ✕ button.
    expect(screen.getAllByRole('button', { name: 'Close bet slip' }).length).toBeGreaterThan(0);
  });

  it('clicking the bottom-nav Bet slip button opens the drawer and shows the selection count badge', async () => {
    useBetSlipStore.setState({ selections: [homeSelection, awaySelection] });
    renderShell();

    const navButton = screen.getByRole('button', { name: 'Bet slip2' });
    expect(navButton).toHaveTextContent('2');

    await userEvent.click(navButton);

    expect(screen.getAllByRole('button', { name: 'Close bet slip' }).length).toBeGreaterThan(0);
  });
});
