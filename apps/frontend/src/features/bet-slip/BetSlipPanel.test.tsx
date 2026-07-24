import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../auth/authStore';
import { useAuthModalStore } from '../auth/authModalStore';
import { useBrandStore } from '../brand/brandStore';
import { BetSlipPanel, type BetSlipPanelProps } from './BetSlipPanel';
import { useBetSlipStore } from './betSlipStore';

function renderPanel(props: BetSlipPanelProps = {}) {
  // No retries - a 404 stub for an endpoint a given test doesn't care about
  // should fail once and settle, not burn through react-query's default
  // exponential backoff before the assertion below even gets to run.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
  useAuthModalStore.setState({ mode: null });
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

  describe('acca rollback bar', () => {
    function stubAccaRollbackConfig(config: {
      minSelections: number;
      lossThreshold: number;
      rewardPercent: number;
      enabled: boolean;
    }) {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL) => {
          const url = typeof input === 'string' ? input : input.toString();
          if (url === '/backend/public/acca-rollback-config/brand-1') {
            return new Response(JSON.stringify(config), { status: 200 });
          }
          return new Response(null, { status: 404 });
        }),
      );
    }

    it('shows nothing when acca rollback is disabled', () => {
      useBrandStore.setState({ brandId: 'brand-1' });
      stubAccaRollbackConfig({ minSelections: 3, lossThreshold: 1, rewardPercent: 100, enabled: false });
      useBetSlipStore.setState({ selections: [homeSelection, awaySelection] });
      renderPanel();

      expect(screen.queryByText(/Acca Rollback/)).not.toBeInTheDocument();
    });

    it('shows a progress nudge before the minimum number of selections is reached', async () => {
      useBrandStore.setState({ brandId: 'brand-1' });
      stubAccaRollbackConfig({ minSelections: 3, lossThreshold: 1, rewardPercent: 100, enabled: true });
      useBetSlipStore.setState({ selections: [homeSelection, awaySelection] });
      renderPanel();

      expect(await screen.findByText('Add 1 more selection to qualify for Acca Rollback')).toBeInTheDocument();
    });

    it('shows a qualifying message once the minimum number of selections is reached', async () => {
      useBrandStore.setState({ brandId: 'brand-1' });
      stubAccaRollbackConfig({ minSelections: 3, lossThreshold: 1, rewardPercent: 100, enabled: true });
      useBetSlipStore.setState({ selections: [homeSelection, awaySelection, drawSelection] });
      renderPanel();

      expect(
        await screen.findByText(
          '🛡️ Will qualify for Acca Rollback - get 100% back as a freebet if it loses by no more than 1 selection',
        ),
      ).toBeInTheDocument();
    });
  });

  describe('insurance bet toggle', () => {
    function stubInsuranceBetConfig(config: { costPercent: number; enabled: boolean }) {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL) => {
          const url = typeof input === 'string' ? input : input.toString();
          if (url === '/backend/public/insurance-bet-config/brand-1') {
            return new Response(JSON.stringify(config), { status: 200 });
          }
          return new Response(null, { status: 404 });
        }),
      );
    }

    it('shows nothing when insurance bet is disabled', () => {
      useBrandStore.setState({ brandId: 'brand-1' });
      stubInsuranceBetConfig({ costPercent: 10, enabled: false });
      useBetSlipStore.setState({ selections: [homeSelection] });
      renderPanel();

      expect(screen.queryByText(/Insure this bet/)).not.toBeInTheDocument();
    });

    it('shows the toggle and reduces the potential payout once checked', async () => {
      useBrandStore.setState({ brandId: 'brand-1' });
      stubInsuranceBetConfig({ costPercent: 10, enabled: true });
      useBetSlipStore.setState({ selections: [homeSelection] });
      renderPanel();

      const toggle = await screen.findByRole('checkbox', { name: /Insure this bet/ });
      expect(toggle).not.toBeChecked();
      // Stake 10.00 * odds 2.1 = 21.00 uninsured.
      expect(screen.getByText('21.00')).toBeInTheDocument();

      await userEvent.click(toggle);

      // 21.00 - 10% cost -> 18.90.
      expect(await screen.findByText('18.90')).toBeInTheDocument();
    });
  });

  describe('stake limit preview alert', () => {
    function stubStakeLimitPreview(preview: {
      maxStakeCents: number | null;
      maxLiabilityCents: number | null;
      effectiveMaxStakeCents: number | null;
    }) {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = typeof input === 'string' ? input : input.toString();
          const method = init?.method ?? 'GET';
          if (method === 'POST' && url === '/backend/public/stake-limit-preview/brand-1') {
            return new Response(JSON.stringify(preview), { status: 200 });
          }
          return new Response(null, { status: 404 });
        }),
      );
    }

    it('shows nothing when no cap applies', () => {
      useBrandStore.setState({ brandId: 'brand-1' });
      stubStakeLimitPreview({ maxStakeCents: null, maxLiabilityCents: null, effectiveMaxStakeCents: null });
      useBetSlipStore.setState({ selections: [homeSelection] });
      renderPanel();

      expect(screen.queryByText(/Max stake/)).not.toBeInTheDocument();
    });

    it('shows an informational note when the typed stake is within the cap', async () => {
      useBrandStore.setState({ brandId: 'brand-1' });
      stubStakeLimitPreview({ maxStakeCents: 5_000, maxLiabilityCents: null, effectiveMaxStakeCents: 5_000 });
      useBetSlipStore.setState({ selections: [homeSelection] });
      renderPanel();

      // Default stake is 10.00 -> 1000 cents, under the 5000-cent cap.
      expect(await screen.findByText('Max stake for this bet: €50.00')).toBeInTheDocument();
      expect(screen.queryByText(/Stake exceeds/)).not.toBeInTheDocument();
    });

    it('shows a warning naming the stake limit once the typed stake exceeds a plain stake cap', async () => {
      useBrandStore.setState({ brandId: 'brand-1' });
      stubStakeLimitPreview({ maxStakeCents: 500, maxLiabilityCents: null, effectiveMaxStakeCents: 500 });
      useBetSlipStore.setState({ selections: [homeSelection] });
      renderPanel();

      // Default stake is 10.00 -> 1000 cents, over the 500-cent cap.
      expect(
        await screen.findByText('Stake exceeds the maximum allowed for this bet (max €5.00, stake limit)'),
      ).toBeInTheDocument();
    });

    it('names the liability limit when that is the binding cap', async () => {
      useBrandStore.setState({ brandId: 'brand-1' });
      stubStakeLimitPreview({ maxStakeCents: 2_000, maxLiabilityCents: 500, effectiveMaxStakeCents: 400 });
      useBetSlipStore.setState({ selections: [homeSelection] });
      renderPanel();

      expect(
        await screen.findByText('Stake exceeds the maximum allowed for this bet (max €4.00, liability limit)'),
      ).toBeInTheDocument();
    });

    it('shows one alert per row on the singles tab with 2+ selections', async () => {
      useBrandStore.setState({ brandId: 'brand-1' });
      stubStakeLimitPreview({ maxStakeCents: 500, maxLiabilityCents: null, effectiveMaxStakeCents: 500 });
      useBetSlipStore.setState({ selections: [homeSelection, awaySelection] });
      renderPanel();

      await userEvent.click(screen.getByRole('tab', { name: /Singles/ }));

      expect(await screen.findAllByText('Stake exceeds the maximum allowed for this bet (max €5.00, stake limit)')).toHaveLength(2);
    });
  });

  describe('freebets', () => {
    function stubFreebetsAndAccaBoost(
      freebets: { id: string; amountCents: number; expiresAt: string | null }[],
      accaBoostConfig?: { boostPercentPerLeg: number; minSelections: number; minOddsPerLeg: number; enabled: boolean },
    ) {
      const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const method = init?.method ?? 'GET';
        if (method === 'GET' && url === '/backend/freebets') {
          return new Response(JSON.stringify(freebets), { status: 200 });
        }
        if (method === 'GET' && url === '/backend/public/acca-boost-config/brand-1') {
          return new Response(
            JSON.stringify(accaBoostConfig ?? { boostPercentPerLeg: 0, minSelections: 99, minOddsPerLeg: 1, enabled: false }),
            { status: 200 },
          );
        }
        if (method === 'POST' && url === '/backend/bets') {
          const body = JSON.parse(init!.body as string);
          return new Response(
            JSON.stringify({
              id: 'bet-1',
              stakeCents: body.stakeCents,
              combinedOdds: '2.10',
              potentialPayoutCents: Math.round(body.stakeCents * 2.1),
              status: 'PENDING',
              createdAt: '2026-07-17T00:00:00Z',
            }),
            { status: 201 },
          );
        }
        return new Response(null, { status: 404 });
      });
      vi.stubGlobal('fetch', fetchMock);
      return fetchMock;
    }

    beforeEach(() => {
      useAuthStore.setState({ accessToken: 'header.payload.signature', user: null, isInitialized: true });
      useBrandStore.setState({ brandId: 'brand-1' });
    });

    it('does not show the Cash/Freebets toggle when the player has no freebet balance', () => {
      stubFreebetsAndAccaBoost([]);
      useBetSlipStore.setState({ selections: [homeSelection] });
      renderPanel();

      expect(screen.queryByRole('tab', { name: 'Freebets' })).not.toBeInTheDocument();
    });

    it('switching to Freebets replaces the stake input with a picker of the player’s freebets', async () => {
      stubFreebetsAndAccaBoost([{ id: 'grant-1', amountCents: 1000, expiresAt: null }]);
      useBetSlipStore.setState({ selections: [homeSelection] });
      renderPanel();

      await userEvent.click(await screen.findByRole('tab', { name: 'Freebets' }));

      expect(screen.getByText('Choose a freebet')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '€10.00' })).toBeInTheDocument();
      expect(screen.queryByLabelText('Stake')).not.toBeInTheDocument();
    });

    it('placing a freebet-funded bet sends the freebetGrantId and the freebet’s own amount as the stake', async () => {
      const fetchMock = stubFreebetsAndAccaBoost([{ id: 'grant-1', amountCents: 1000, expiresAt: null }]);
      useBetSlipStore.setState({ selections: [homeSelection] });
      renderPanel();

      await userEvent.click(await screen.findByRole('tab', { name: 'Freebets' }));
      await userEvent.click(screen.getByRole('button', { name: '€10.00' }));
      await userEvent.click(screen.getByRole('button', { name: 'Place Bet' }));

      await screen.findByText(/Bet placed!/);
      const betCall = fetchMock.mock.calls.find((call) => call[0] === '/backend/bets')!;
      const [, init] = betCall as [string, RequestInit];
      expect(JSON.parse(init.body as string)).toEqual({
        selections: [homeSelection],
        stakeCents: 1000,
        freebetGrantId: 'grant-1',
      });
    });

    it('hides the Acca Boost bar in freebet mode even for a qualifying accumulator', async () => {
      stubFreebetsAndAccaBoost(
        [{ id: 'grant-1', amountCents: 1000, expiresAt: null }],
        { boostPercentPerLeg: 5, minSelections: 2, minOddsPerLeg: 1.2, enabled: true },
      );
      useBetSlipStore.setState({ selections: [homeSelection, awaySelection] });
      renderPanel();

      expect(await screen.findByText(/Acca Boost/)).toBeInTheDocument();

      await userEvent.click(screen.getByRole('tab', { name: 'Freebets' }));

      expect(screen.queryByText(/Acca Boost/)).not.toBeInTheDocument();
    });

    it('falls back to Cash automatically when switching to Singles with 2+ selections while in freebet mode', async () => {
      stubFreebetsAndAccaBoost([{ id: 'grant-1', amountCents: 1000, expiresAt: null }]);
      useBetSlipStore.setState({ selections: [homeSelection, awaySelection] });
      renderPanel();

      await userEvent.click(await screen.findByRole('tab', { name: 'Freebets' }));
      expect(screen.getByRole('tab', { name: 'Freebets' })).toHaveAttribute('aria-selected', 'true');

      await userEvent.click(screen.getByRole('tab', { name: 'Singles' }));

      expect(screen.getByRole('tab', { name: 'Cash' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.queryByText('Choose a freebet')).not.toBeInTheDocument();
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

  it('shows a Log in button instead of a disabled Place Bet button when logged out', async () => {
    useBetSlipStore.setState({ selections: [homeSelection] });
    renderPanel();

    expect(screen.queryByRole('button', { name: 'Place Bet' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Log in to place a bet' }));
    expect(useAuthModalStore.getState().mode).toBe('login');
  });

  it('places a bet, shows a confirmation, and clears the slip when logged in', async () => {
    useAuthStore.setState({
      accessToken: 'header.payload.signature',
      user: null,
      isInitialized: true,
    });
    useBetSlipStore.setState({ selections: [homeSelection, awaySelection] });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/backend/freebets') {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response(
        JSON.stringify({
          id: 'bet-1',
          stakeCents: 1000,
          combinedOdds: '5.25',
          potentialPayoutCents: 5250,
          status: 'PENDING',
          createdAt: '2026-07-17T00:00:00Z',
        }),
        { status: 201 },
      );
    });
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

    const betCall = fetchMock.mock.calls.find((call) => call[0] === '/backend/bets')!;
    const [url, requestInit] = betCall as [string, RequestInit];
    expect(url).toBe('/backend/bets');
    expect(JSON.parse(requestInit.body as string)).toEqual({
      selections: [homeSelection, awaySelection],
      stakeCents: 1000,
      insuranceOptIn: false,
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
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/backend/freebets') {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response(
        JSON.stringify({
          id: 'bet-1',
          stakeCents: 1000,
          combinedOdds: '2.10',
          potentialPayoutCents: 2100,
          status: 'PENDING',
          createdAt: '2026-07-17T00:00:00Z',
        }),
        { status: 201 },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPanel();
    await userEvent.click(screen.getByRole('tab', { name: 'Singles' }));

    await userEvent.click(screen.getByRole('button', { name: 'Place Bet' }));

    await screen.findByText(/Bet placed!/);
    expect(useBetSlipStore.getState().selections).toEqual([]);
    const betCalls = fetchMock.mock.calls.filter((call) => call[0] === '/backend/bets');
    expect(betCalls).toHaveLength(2);

    const bodies = betCalls.map((call) => {
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
    // A fresh Response per call - useBets and useFreebets both fetch on
    // mount, and a Response body can only be read once, so reusing a single
    // mockResolvedValue instance across both would make the second .json()
    // read fail as if the network had actually done that.
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([]), { status: 200 })));
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
