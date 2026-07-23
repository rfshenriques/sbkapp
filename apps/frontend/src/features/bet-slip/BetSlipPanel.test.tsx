import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../auth/authStore';
import { useBrandStore } from '../brand/brandStore';
import { BetSlipPanel, type BetSlipPanelProps } from './BetSlipPanel';
import { useBetSlipStore } from './betSlipStore';

function renderPanel(props: BetSlipPanelProps = {}) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <BetSlipPanel {...props} />
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

const drawSelection = {
  matchId: 'match-3',
  marketId: 'match-result',
  selectionId: 'draw',
  matchLabel: 'Inter vs Milan',
  marketName: 'Match Result',
  selectionName: 'Draw',
  odds: 2.0,
};

beforeEach(() => {
  useBetSlipStore.setState({ selections: [] });
  useAuthStore.setState({ accessToken: null, user: null, isInitialized: true });
  useBrandStore.setState({ brandId: undefined });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('BetSlipPanel', () => {
  it('shows an empty state when there are no selections', () => {
    renderPanel();

    expect(screen.getByText('Your bet slip is empty.')).toBeInTheDocument();
  });

  it('lists every selection with its combined odds', () => {
    useBetSlipStore.setState({ selections: [homeSelection, awaySelection] });
    renderPanel();

    expect(screen.getByText('Arsenal vs Chelsea')).toBeInTheDocument();
    expect(screen.getByText('Match Result: Home')).toBeInTheDocument();
    expect(screen.getByText('Liverpool vs Manchester City')).toBeInTheDocument();

    // combined odds = 2.1 * 2.5 = 5.25, shown once in the always-visible
    // stake field's odds badge - no separate "Combined odds" line.
    expect(screen.getByText('5.25')).toBeInTheDocument();
  });

  it('shows a Boost badge and the struck-through original price for a boosted selection, and the payout uses the boosted price', () => {
    const boostedHome = { ...homeSelection, odds: 2.5, originalOdds: 2.1 };
    useBetSlipStore.setState({ selections: [boostedHome] });
    renderPanel();

    expect(screen.getByText('Boost')).toBeInTheDocument();
    expect(screen.getByText('2.10')).toBeInTheDocument();
    expect(screen.getAllByText('2.50').length).toBeGreaterThan(0);
  });

  it('shows the Boost badge on every boosted accumulator row, not on unboosted ones', () => {
    const boostedHome = { ...homeSelection, odds: 2.5, originalOdds: 2.1 };
    useBetSlipStore.setState({ selections: [boostedHome, awaySelection] });
    renderPanel();

    // Accumulator is the default tab once there are 2+ selections.
    expect(screen.getAllByText('Boost')).toHaveLength(1);
    expect(screen.getByText('2.10')).toBeInTheDocument();
  });

  describe('acca boost bar', () => {
    function stubAccaBoostConfig(config: {
      boostPercentPerLeg: number;
      minSelections: number;
      minOddsPerLeg: number;
      enabled: boolean;
    }) {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL) => {
          const url = typeof input === 'string' ? input : input.toString();
          if (url === '/backend/public/acca-boost-config/brand-1') {
            return new Response(JSON.stringify(config), { status: 200 });
          }
          return new Response(null, { status: 404 });
        }),
      );
    }

    it('shows nothing when acca boost is disabled', () => {
      useBrandStore.setState({ brandId: 'brand-1' });
      stubAccaBoostConfig({ boostPercentPerLeg: 5, minSelections: 3, minOddsPerLeg: 1.2, enabled: false });
      useBetSlipStore.setState({ selections: [homeSelection, awaySelection] });
      renderPanel();

      expect(screen.queryByText(/Acca Boost/)).not.toBeInTheDocument();
    });

    it('shows a progress nudge before the minimum number of selections is reached', async () => {
      useBrandStore.setState({ brandId: 'brand-1' });
      stubAccaBoostConfig({ boostPercentPerLeg: 5, minSelections: 3, minOddsPerLeg: 1.2, enabled: true });
      useBetSlipStore.setState({ selections: [homeSelection, awaySelection] });
      renderPanel();

      expect(await screen.findByText('Add 1 more selection to unlock Acca Boost')).toBeInTheDocument();
    });

    it('shows the applied boost percent and next-leg nudge once qualifying, and boosts the potential payout', async () => {
      useBrandStore.setState({ brandId: 'brand-1' });
      stubAccaBoostConfig({ boostPercentPerLeg: 5, minSelections: 3, minOddsPerLeg: 1.2, enabled: true });
      useBetSlipStore.setState({ selections: [homeSelection, awaySelection, drawSelection] });
      renderPanel();

      // 2.1 * 2.5 * 2.0 = 10.5 base; 3 legs x 5% = 15% -> 12.08 (rounded).
      expect(await screen.findByText('🚀 Acca Boost +15%')).toBeInTheDocument();
      expect(screen.getByText('+5% for 1 more selection')).toBeInTheDocument();
      // Combined odds shows both the pre-boost and boosted figures, not just the end result.
      expect(screen.getByText('10.50')).toBeInTheDocument();
      expect(screen.getByText('12.08')).toBeInTheDocument();
    });

    it('shows a disqualified message when a leg is under the minimum odds, even with enough selections', async () => {
      useBrandStore.setState({ brandId: 'brand-1' });
      stubAccaBoostConfig({ boostPercentPerLeg: 5, minSelections: 3, minOddsPerLeg: 1.2, enabled: true });
      const shortOddsSelection = { ...drawSelection, odds: 1.1 };
      useBetSlipStore.setState({ selections: [homeSelection, awaySelection, shortOddsSelection] });
      renderPanel();

      expect(
        await screen.findByText('Every selection needs odds of at least 1.20 to qualify for Acca Boost.'),
      ).toBeInTheDocument();
    });
  });

  it('removes a selection when its remove button is clicked', async () => {
    useBetSlipStore.setState({ selections: [homeSelection, awaySelection] });
    renderPanel();

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove Home for Arsenal vs Chelsea' }),
    );

    expect(useBetSlipStore.getState().selections).toEqual([awaySelection]);
  });

  it('clears every selection when Clear is clicked', async () => {
    useBetSlipStore.setState({ selections: [homeSelection, awaySelection] });
    renderPanel();

    await userEvent.click(screen.getByRole('button', { name: 'Clear bet slip' }));

    expect(useBetSlipStore.getState().selections).toEqual([]);
  });

  it('shows a Log in button instead of a disabled Place Bet button when logged out', () => {
    useBetSlipStore.setState({ selections: [homeSelection] });
    renderPanel();

    expect(screen.queryByRole('button', { name: 'Place Bet' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log in to place a bet' })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  it('places a bet, shows a confirmation, and clears the slip when logged in', async () => {
    useAuthStore.setState({
      accessToken: 'header.payload.signature',
      user: null,
      isInitialized: true,
    });
    useBetSlipStore.setState({ selections: [homeSelection, awaySelection] });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'bet-1',
          stakeCents: 1000,
          combinedOdds: '5.25',
          potentialPayoutCents: 5250,
          status: 'PENDING',
          createdAt: '2026-07-17T00:00:00Z',
        }),
        { status: 201 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    renderPanel();

    const stakeInput = screen.getByLabelText('Stake');
    await userEvent.clear(stakeInput);
    await userEvent.type(stakeInput, '10');
    await userEvent.click(screen.getByRole('button', { name: 'Place Bet' }));

    expect(
      await screen.findByText(/Bet placed! Stake 10.00, potential payout 52.50/),
    ).toBeInTheDocument();
    expect(useBetSlipStore.getState().selections).toEqual([]);

    const [url, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/backend/bets');
    expect(JSON.parse(requestInit.body as string)).toEqual({
      selections: [homeSelection, awaySelection],
      stakeCents: 1000,
    });
  });

  it('shows no tabs and no combined odds for a single selection', () => {
    useBetSlipStore.setState({ selections: [homeSelection] });
    renderPanel();

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByText('Combined odds')).not.toBeInTheDocument();
    // Just the row header's own odds - the stake field hides its own odds
    // badge for singles, since it would only repeat this same figure.
    expect(screen.getByText('2.10')).toBeInTheDocument();
  });

  it('defaults to the Accumulator tab once there are 2+ selections', () => {
    useBetSlipStore.setState({ selections: [homeSelection, awaySelection] });
    renderPanel();

    expect(screen.getByRole('tab', { name: 'Accumulator (2)' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Singles' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByText('Potential payout')).toBeInTheDocument();
  });

  it('switches to Accumulator when a second selection is added while already mounted (desktop persistent panel)', async () => {
    // No remount involved here (unlike the mobile drawer, which remounts on
    // every open) - this is the scenario a persistently-mounted desktop
    // panel actually hits.
    useBetSlipStore.setState({ selections: [homeSelection] });
    renderPanel();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();

    useBetSlipStore.setState({ selections: [homeSelection, awaySelection] });

    expect(await screen.findByRole('tab', { name: 'Accumulator (2)' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('does not force Accumulator back on if the user manually switched to Singles', async () => {
    useBetSlipStore.setState({ selections: [homeSelection, awaySelection] });
    renderPanel();
    await userEvent.click(screen.getByRole('tab', { name: 'Singles' }));

    // Adding a third selection shouldn't yank the user back to Accumulator.
    useBetSlipStore.setState({
      selections: [homeSelection, awaySelection, { ...homeSelection, matchId: 'match-3' }],
    });

    expect(await screen.findByRole('tab', { name: 'Singles' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('switching to Singles shows each selection with its own stake field but one shared Place Bet button', async () => {
    useAuthStore.setState({ accessToken: 'header.payload.signature', user: null, isInitialized: true });
    useBetSlipStore.setState({ selections: [homeSelection, awaySelection] });
    renderPanel();

    await userEvent.click(screen.getByRole('tab', { name: 'Singles' }));

    expect(screen.queryByText('Combined odds')).not.toBeInTheDocument();
    const stakeInputs = screen.getAllByLabelText('Stake');
    expect(stakeInputs).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Place Bet' })).toHaveLength(1);
  });

  it('placing singles from the one bottom button places every selection together, each with its own stake', async () => {
    useAuthStore.setState({ accessToken: 'header.payload.signature', user: null, isInitialized: true });
    useBetSlipStore.setState({ selections: [homeSelection, awaySelection] });
    // A fresh Response per call - both singles are placed concurrently via
    // Promise.all, and a Response body can only be read once, so reusing a
    // single mockResolvedValue instance across both calls would make the
    // second .json() read fail as if the network had actually done that.
    const fetchMock = vi.fn().mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            id: 'bet-1',
            stakeCents: 1000,
            combinedOdds: '2.10',
            potentialPayoutCents: 2100,
            status: 'PENDING',
            createdAt: '2026-07-17T00:00:00Z',
          }),
          { status: 201 },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    renderPanel();
    await userEvent.click(screen.getByRole('tab', { name: 'Singles' }));

    await userEvent.click(screen.getByRole('button', { name: 'Place Bet' }));

    await screen.findByText(/Bet placed!/);
    expect(useBetSlipStore.getState().selections).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const bodies = fetchMock.mock.calls.map((call) => {
      const [, init] = call as [string, RequestInit];
      return JSON.parse(init.body as string);
    });
    expect(bodies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ selections: [homeSelection] }),
        expect.objectContaining({ selections: [awaySelection] }),
      ]),
    );
  });

  it('does not show a History tab by default (mobile drawer)', () => {
    renderPanel();

    expect(screen.queryByRole('tab', { name: 'Bet History' })).not.toBeInTheDocument();
  });

  it('shows a Bet Slip / History tab pair when showHistoryTab is set (desktop)', async () => {
    useAuthStore.setState({ accessToken: 'header.payload.signature', user: null, isInitialized: true });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 })));
    renderPanel({ showHistoryTab: true });

    expect(screen.getByRole('tab', { name: 'Bet Slip' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Your bet slip is empty.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Bet History' }));

    expect(screen.getByRole('tab', { name: 'Bet History' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText('No bets placed yet')).toBeInTheDocument();
  });

  it('shows the compact empty state by default and the promotional one when requested', () => {
    const { unmount } = renderPanel();
    expect(screen.getByText('Your bet slip is empty.')).toBeInTheDocument();
    unmount();

    renderPanel({ emptyStateVariant: 'promotional' });
    expect(screen.getByText('Add selections to your bet slip')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse matches' })).toHaveAttribute('href', '/');
  });
});
