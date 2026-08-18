import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../auth/authStore';
import { useAuthModalStore } from '../auth/authModalStore';
import { useBrandStore } from '../brand/brandStore';
import { useInsufficientFundsModalStore } from '../wallet/insufficientFundsModalStore';
import { BetSlipPanel, type BetSlipPanelProps } from './BetSlipPanel';
import { useBetPlacedModalStore } from './betPlacedModalStore';
import { useBetSlipSettingsStore } from './betSlipSettingsStore';
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
  useBetSlipStore.setState({ selections: [], stake: '10.00', singleStakes: {} });
  useAuthStore.setState({ accessToken: null, user: null, isInitialized: true });
  useAuthModalStore.setState({ mode: null });
  useBrandStore.setState({ brandId: undefined });
  useInsufficientFundsModalStore.setState({ isOpen: false });
  useBetPlacedModalStore.setState({ summary: null });
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

  it('shows the struck-through original price for a boosted selection, and the payout uses the boosted price', () => {
    const boostedHome = { ...homeSelection, odds: 2.5, originalOdds: 2.1 };
    useBetSlipStore.setState({ selections: [boostedHome] });
    renderPanel();

    expect(screen.getByText('2.10')).toBeInTheDocument();
    expect(screen.getAllByText('2.50').length).toBeGreaterThan(0);
  });

  it('shows the struck-through original price on every boosted accumulator row, not on unboosted ones', () => {
    const boostedHome = { ...homeSelection, odds: 2.5, originalOdds: 2.1 };
    useBetSlipStore.setState({ selections: [boostedHome, awaySelection] });
    renderPanel();

    // Accumulator is the default tab once there are 2+ selections.
    expect(screen.getAllByText('2.10')).toHaveLength(1);
  });

  it("shows a 'Singles only' note for a singles-only manual market selection, alongside its max stake", () => {
    const noveltySelection = {
      ...homeSelection,
      marketName: 'Novelty Market',
      marketSinglesOnly: true,
      maxStakeCents: 2_000,
    };
    useBetSlipStore.setState({ selections: [noveltySelection] });
    renderPanel();

    expect(screen.getByText('Max stake: 20.00 € · Singles only')).toBeInTheDocument();
  });

  it("shows just 'Singles only' when a singles-only manual market has no configured max stake", () => {
    const noveltySelection = { ...homeSelection, marketName: 'Novelty Market', marketSinglesOnly: true };
    useBetSlipStore.setState({ selections: [noveltySelection] });
    renderPanel();

    expect(screen.getByText('Singles only')).toBeInTheDocument();
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
      // Default stake 10.00: base potential winnings 105.00, boosted 120.80 -
      // the boosted figure appears twice (the boost bar's own before/after
      // preview, and the footer's "Potential payout", now both showing the
      // same currency-formatted value since the footer stopped showing a
      // bare number).
      expect(screen.getByText('105.00 €')).toBeInTheDocument();
      expect(screen.getAllByText('120.80 €')).toHaveLength(2);
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

    it('shows a compact qualifying summary, expanding to the full reward message on click', async () => {
      useBrandStore.setState({ brandId: 'brand-1' });
      stubAccaRollbackConfig({ minSelections: 3, lossThreshold: 1, rewardPercent: 100, enabled: true });
      useBetSlipStore.setState({ selections: [homeSelection, awaySelection, drawSelection] });
      renderPanel();

      const toggle = await screen.findByRole('button', { name: '🛡️ Acca Rollback qualified' });
      expect(
        screen.queryByText(
          'Will qualify for Acca Rollback - get 100% back as a freebet if it loses by no more than 1 selection',
        ),
      ).not.toBeInTheDocument();

      await userEvent.click(toggle);

      expect(
        screen.getByText(
          'Will qualify for Acca Rollback - get 100% back as a freebet if it loses by no more than 1 selection',
        ),
      ).toBeInTheDocument();
    });
  });

  describe('insurance opt-in excludes acca boost and acca rollback', () => {
    function stubAllThreeConfigs(config: { costPercent: number }) {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL) => {
          const url = typeof input === 'string' ? input : input.toString();
          if (url === '/backend/public/acca-boost-config/brand-1') {
            return new Response(
              JSON.stringify({ boostPercentPerLeg: 5, minSelections: 3, minOddsPerLeg: 1.2, enabled: true }),
              { status: 200 },
            );
          }
          if (url === '/backend/public/acca-rollback-config/brand-1') {
            return new Response(
              JSON.stringify({ minSelections: 3, lossThreshold: 1, rewardPercent: 100, enabled: true }),
              { status: 200 },
            );
          }
          if (url === '/backend/public/insurance-bet-config/brand-1') {
            return new Response(
              JSON.stringify({ costPercent: config.costPercent, enabled: true, minOdds: 1 }),
              { status: 200 },
            );
          }
          return new Response(null, { status: 404 });
        }),
      );
    }

    it('hides the Acca Boost and Acca Rollback bars once insurance is toggled on, and un-boosts the odds', async () => {
      useBrandStore.setState({ brandId: 'brand-1' });
      stubAllThreeConfigs({ costPercent: 10 });
      useBetSlipStore.setState({ selections: [homeSelection, awaySelection, drawSelection] });
      renderPanel();

      expect(await screen.findByText('🚀 Acca Boost +15%')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '🛡️ Acca Rollback qualified' })).toBeInTheDocument();

      const toggle = await screen.findByRole('switch', { name: /Insure this bet/ });
      await userEvent.click(toggle);

      expect(screen.queryByText(/Acca Boost/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Acca Rollback/)).not.toBeInTheDocument();
      // Boost no longer applies once insured - combined odds falls back to the base 10.50.
      expect(screen.getByText('10.50')).toBeInTheDocument();
    });
  });

  describe('invalid accumulator combination alert', () => {
    it('shows nothing and allows placing when the combination is fine', () => {
      useBetSlipStore.setState({ selections: [homeSelection, awaySelection] });
      renderPanel();

      expect(screen.queryByText(/can only be bet as a single/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Only one boosted selection/)).not.toBeInTheDocument();
    });

    it('warns and disables placing a bet with two boosted selections combined', () => {
      const boostedHome = { ...homeSelection, odds: 2.5, originalOdds: 2.1 };
      const boostedAway = { ...awaySelection, odds: 3.0, originalOdds: 2.5 };
      useBetSlipStore.setState({ selections: [boostedHome, boostedAway] });
      renderPanel();

      expect(
        screen.getByText('Only one boosted selection can be combined in an accumulator.'),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
    });

    it('warns when a singles-only manual market is combined with another selection', () => {
      const noveltySelection = { ...homeSelection, marketName: 'Novelty Market', marketSinglesOnly: true };
      useBetSlipStore.setState({ selections: [noveltySelection, awaySelection] });
      renderPanel();

      expect(
        screen.getByText('Novelty Market can only be bet as a single, not combined in an accumulator.'),
      ).toBeInTheDocument();
    });

    it('never warns on the singles tab, since each selection there is its own separate bet', async () => {
      const boostedHome = { ...homeSelection, odds: 2.5, originalOdds: 2.1 };
      const boostedAway = { ...awaySelection, odds: 3.0, originalOdds: 2.5 };
      useBetSlipStore.setState({ selections: [boostedHome, boostedAway] });
      renderPanel();

      await userEvent.click(screen.getByRole('tab', { name: /Singles/ }));

      expect(screen.queryByText(/Only one boosted selection/)).not.toBeInTheDocument();
    });

    it('auto-selects the Singles tab and warns for two selections from the same event', async () => {
      const totalGoalsSelection = {
        ...homeSelection,
        marketId: 'total-goals',
        marketName: 'Total Goals',
        selectionId: 'over',
        selectionName: 'Over 2.5',
      };
      useBetSlipStore.setState({ selections: [homeSelection, totalGoalsSelection] });
      renderPanel();

      expect(await screen.findByRole('tab', { name: /Singles/, selected: true })).toBeInTheDocument();

      await userEvent.click(screen.getByRole('tab', { name: /Accumulator/ }));

      expect(
        screen.getByText("Selections from the same event can't be combined into an accumulator."),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
    });

    it('hides Acca Boost/Rollback and shows a slash for odds and payout for a same-event conflict', async () => {
      useBrandStore.setState({ brandId: 'brand-1' });
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL) => {
          const url = typeof input === 'string' ? input : input.toString();
          if (url === '/backend/public/acca-boost-config/brand-1') {
            return new Response(
              JSON.stringify({ boostPercentPerLeg: 5, minSelections: 2, minOddsPerLeg: 1.2, enabled: true }),
              { status: 200 },
            );
          }
          if (url === '/backend/public/acca-rollback-config/brand-1') {
            return new Response(
              JSON.stringify({ minSelections: 2, lossThreshold: 1, rewardPercent: 100, enabled: true }),
              { status: 200 },
            );
          }
          return new Response(null, { status: 404 });
        }),
      );
      const totalGoalsSelection = {
        ...homeSelection,
        marketId: 'total-goals',
        marketName: 'Total Goals',
        selectionId: 'over',
        selectionName: 'Over 2.5',
      };
      useBetSlipStore.setState({ selections: [homeSelection, totalGoalsSelection] });
      renderPanel();

      await userEvent.click(await screen.findByRole('tab', { name: /Accumulator/ }));

      expect(screen.queryByText(/Acca Boost/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Acca Rollback/)).not.toBeInTheDocument();
      expect(screen.getByLabelText('Odds not combinable')).toHaveTextContent('/');
      expect(screen.getByLabelText('Payout not combinable')).toHaveTextContent('/');
    });

    it('disables Place Bet (not just hides it) for a logged-in player with a same-event conflict', async () => {
      useAuthStore.setState({ accessToken: 'header.payload.signature', user: null, isInitialized: true });
      const totalGoalsSelection = {
        ...homeSelection,
        marketId: 'total-goals',
        marketName: 'Total Goals',
        selectionId: 'over',
        selectionName: 'Over 2.5',
      };
      useBetSlipStore.setState({ selections: [homeSelection, totalGoalsSelection] });
      renderPanel();

      await userEvent.click(await screen.findByRole('tab', { name: /Accumulator/ }));

      expect(screen.getByRole('button', { name: 'Place Bet' })).toBeDisabled();
    });
  });

  describe('insurance bet toggle', () => {
    function stubInsuranceBetConfig(config: { costPercent: number; enabled: boolean; minOdds?: number }) {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL) => {
          const url = typeof input === 'string' ? input : input.toString();
          if (url === '/backend/public/insurance-bet-config/brand-1') {
            return new Response(JSON.stringify({ minOdds: 1, ...config }), { status: 200 });
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

      const toggle = await screen.findByRole('switch', { name: /Insure this bet/ });
      expect(toggle).not.toBeChecked();
      // Stake 10.00 * odds 2.1 = 21.00 uninsured.
      expect(screen.getByText('21.00 €')).toBeInTheDocument();

      await userEvent.click(toggle);

      // 21.00 - 10% cost -> 18.90, shown as a before/after (21.00 € -> 18.90 €).
      expect(await screen.findByText('18.90 €')).toBeInTheDocument();
      expect(screen.getByText('21.00 €')).toBeInTheDocument();
    });

    it('hides the toggle entirely for a boosted selection', async () => {
      useBrandStore.setState({ brandId: 'brand-1' });
      stubInsuranceBetConfig({ costPercent: 10, enabled: true });
      const boostedHome = { ...homeSelection, odds: 2.5, originalOdds: 2.1 };
      useBetSlipStore.setState({ selections: [boostedHome] });
      renderPanel();

      await screen.findByText('2.50');
      expect(screen.queryByText(/Insure this bet/)).not.toBeInTheDocument();
    });

    it('hides the toggle entirely for a singles-only manual market selection', async () => {
      useBrandStore.setState({ brandId: 'brand-1' });
      stubInsuranceBetConfig({ costPercent: 10, enabled: true });
      const noveltySelection = { ...homeSelection, marketName: 'Novelty Market', marketSinglesOnly: true };
      useBetSlipStore.setState({ selections: [noveltySelection] });
      renderPanel();

      await screen.findByText('Novelty Market: Home');
      expect(screen.queryByText(/Insure this bet/)).not.toBeInTheDocument();
    });

    it('hides the toggle when the single selection\'s odds fall short of the configured minimum', async () => {
      useBrandStore.setState({ brandId: 'brand-1' });
      stubInsuranceBetConfig({ costPercent: 10, enabled: true, minOdds: 3 });
      useBetSlipStore.setState({ selections: [homeSelection] });
      renderPanel();

      await screen.findByText('21.00 €');
      expect(screen.queryByText(/Insure this bet/)).not.toBeInTheDocument();
    });

    it('shows the toggle once the single selection\'s odds meet the configured minimum', async () => {
      useBrandStore.setState({ brandId: 'brand-1' });
      stubInsuranceBetConfig({ costPercent: 10, enabled: true, minOdds: 2.1 });
      useBetSlipStore.setState({ selections: [homeSelection] });
      renderPanel();

      expect(await screen.findByRole('switch', { name: /Insure this bet/ })).toBeInTheDocument();
    });

    it('hides the toggle on the accumulator tab when the combined odds fall short of the configured minimum', async () => {
      useBrandStore.setState({ brandId: 'brand-1' });
      stubInsuranceBetConfig({ costPercent: 10, enabled: true, minOdds: 10 });
      useBetSlipStore.setState({ selections: [homeSelection, awaySelection] });
      renderPanel();

      await userEvent.click(await screen.findByRole('tab', { name: /Accumulator/ }));

      expect(screen.queryByText(/Insure this bet/)).not.toBeInTheDocument();
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
      expect(await screen.findByText('Max stake for this bet: 50.00 €')).toBeInTheDocument();
      expect(screen.queryByText(/Stake exceeds/)).not.toBeInTheDocument();
    });

    it('shows a warning naming the stake limit once the typed stake exceeds a plain stake cap', async () => {
      useBrandStore.setState({ brandId: 'brand-1' });
      stubStakeLimitPreview({ maxStakeCents: 500, maxLiabilityCents: null, effectiveMaxStakeCents: 500 });
      useBetSlipStore.setState({ selections: [homeSelection] });
      renderPanel();

      // Default stake is 10.00 -> 1000 cents, over the 500-cent cap.
      expect(
        await screen.findByText('Stake exceeds the maximum allowed for this bet (max 5.00 €, stake limit)'),
      ).toBeInTheDocument();
    });

    it('names the liability limit when that is the binding cap', async () => {
      useBrandStore.setState({ brandId: 'brand-1' });
      stubStakeLimitPreview({ maxStakeCents: 2_000, maxLiabilityCents: 500, effectiveMaxStakeCents: 400 });
      useBetSlipStore.setState({ selections: [homeSelection] });
      renderPanel();

      expect(
        await screen.findByText('Stake exceeds the maximum allowed for this bet (max 4.00 €, liability limit)'),
      ).toBeInTheDocument();
    });

    it('shows one alert per row on the singles tab with 2+ selections', async () => {
      useBrandStore.setState({ brandId: 'brand-1' });
      stubStakeLimitPreview({ maxStakeCents: 500, maxLiabilityCents: null, effectiveMaxStakeCents: 500 });
      useBetSlipStore.setState({ selections: [homeSelection, awaySelection] });
      renderPanel();

      await userEvent.click(screen.getByRole('tab', { name: /Singles/ }));

      expect(await screen.findAllByText('Stake exceeds the maximum allowed for this bet (max 5.00 €, stake limit)')).toHaveLength(2);
    });
  });

  describe('campaign qualification preview', () => {
    function stubCampaignPreview(preview: {
      betAndGetCampaignName: string | null;
      betAndGetCampaignRewardCents: number | null;
      depositCampaignName: string | null;
      depositCampaignRewardCents: number | null;
      registerCampaignName?: string | null;
      registerCampaignRewardCents?: number | null;
    }) {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = typeof input === 'string' ? input : input.toString();
          const method = init?.method ?? 'GET';
          if (method === 'POST' && url === '/backend/public/campaign-preview/brand-1') {
            return new Response(
              JSON.stringify({ registerCampaignName: null, registerCampaignRewardCents: null, ...preview }),
              { status: 200 },
            );
          }
          return new Response(null, { status: 404 });
        }),
      );
    }

    it('shows nothing when the bet qualifies for no campaign', () => {
      useBrandStore.setState({ brandId: 'brand-1' });
      stubCampaignPreview({
        betAndGetCampaignName: null,
        betAndGetCampaignRewardCents: null,
        depositCampaignName: null,
        depositCampaignRewardCents: null,
      });
      useBetSlipStore.setState({ selections: [homeSelection] });
      renderPanel();

      expect(screen.queryByText(/Qualifies for/)).not.toBeInTheDocument();
    });

    it('names the campaign and its freebet reward once the preview resolves', async () => {
      useBrandStore.setState({ brandId: 'brand-1' });
      stubCampaignPreview({
        betAndGetCampaignName: 'CL Bet & Get',
        betAndGetCampaignRewardCents: 1000,
        depositCampaignName: null,
        depositCampaignRewardCents: null,
      });
      useBetSlipStore.setState({ selections: [homeSelection] });
      const { container } = renderPanel();

      const note = await screen.findByText('CL Bet & Get', { exact: false });
      expect(note.closest('div')).toHaveClass('text-highlight');
      expect(container.querySelector('div.text-highlight')).toHaveTextContent(
        '🎁 Qualifies for CL Bet & Get',
      );
      expect(container.querySelector('div.text-highlight')).toHaveTextContent('10.00 € in Freebets');
    });

    it('shows both a Bet & Get and a deposit campaign qualification at once', async () => {
      useBrandStore.setState({ brandId: 'brand-1' });
      stubCampaignPreview({
        betAndGetCampaignName: 'CL Bet & Get',
        betAndGetCampaignRewardCents: 1000,
        depositCampaignName: 'Welcome Deposit Bonus',
        depositCampaignRewardCents: 2500,
      });
      useBetSlipStore.setState({ selections: [homeSelection] });
      const { container } = renderPanel();

      await screen.findByText('CL Bet & Get', { exact: false });
      const notes = container.querySelectorAll('div.text-highlight');
      expect(notes).toHaveLength(2);
      expect(notes[0]).toHaveTextContent('🎁 Qualifies for CL Bet & Get');
      expect(notes[0]).toHaveTextContent('10.00 € in Freebets');
      expect(notes[1]).toHaveTextContent('🎁 Qualifies for Welcome Deposit Bonus');
      expect(notes[1]).toHaveTextContent('25.00 € in Freebets');
    });
  });

  describe('freebets', () => {
    function stubFreebetsAndAccaBoost(
      freebets: { id: string; amountCents: number; remainingCents: number; expiresAt: string | null }[],
      accaBoostConfig?: { boostPercentPerLeg: number; minSelections: number; minOddsPerLeg: number; enabled: boolean },
    ) {
      const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const method = init?.method ?? 'GET';
        if (method === 'GET' && url === '/backend/freebets') {
          return new Response(JSON.stringify(freebets), { status: 200 });
        }
        if (method === 'GET' && url === '/backend/wallet') {
          return new Response(JSON.stringify({ balanceCents: 100000 }), { status: 200 });
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

      expect(screen.queryByRole('switch', { name: 'Pay with freebets' })).not.toBeInTheDocument();
    });

    it('switching to Freebets keeps the same typed stake input - freebets act like a second wallet, not a fixed-value token', async () => {
      stubFreebetsAndAccaBoost([{ id: 'grant-1', amountCents: 1000, remainingCents: 1000, expiresAt: null }]);
      useBetSlipStore.setState({ selections: [homeSelection] });
      renderPanel();

      await userEvent.click(await screen.findByRole('switch', { name: 'Pay with freebets' }));

      expect(screen.getByLabelText('Stake')).toBeInTheDocument();
      expect(screen.queryByText('Choose a freebet')).not.toBeInTheDocument();
    });

    it('shows "Potential payout" (never "Potential winnings") as stake x odds, even in freebet mode', async () => {
      stubFreebetsAndAccaBoost([{ id: 'grant-1', amountCents: 1000, remainingCents: 1000, expiresAt: null }]);
      useBetSlipStore.setState({ selections: [homeSelection] });
      renderPanel();

      await userEvent.click(await screen.findByRole('switch', { name: 'Pay with freebets' }));
      const stakeInput = screen.getByLabelText('Stake');
      await userEvent.clear(stakeInput);
      await userEvent.type(stakeInput, '3');

      expect(screen.getByText('Potential payout')).toBeInTheDocument();
      expect(screen.queryByText('Potential winnings')).not.toBeInTheDocument();
      // stake 3 x odds 2.1 = 6.30 - the full payout, not the 3.30 net-winnings figure.
      expect(screen.getByText('6.30 €')).toBeInTheDocument();
    });

    it('placing a freebet-funded bet sends useFreebets and whatever stake the player typed, not the grant’s own amount', async () => {
      const fetchMock = stubFreebetsAndAccaBoost([{ id: 'grant-1', amountCents: 1000, remainingCents: 1000, expiresAt: null }]);
      useBetSlipStore.setState({ selections: [homeSelection] });
      renderPanel();

      await userEvent.click(await screen.findByRole('switch', { name: 'Pay with freebets' }));
      const stakeInput = screen.getByLabelText('Stake');
      await userEvent.clear(stakeInput);
      await userEvent.type(stakeInput, '3');
      await userEvent.click(screen.getByRole('button', { name: 'Place Bet' }));

      await waitFor(() => expect(useBetPlacedModalStore.getState().summary).not.toBeNull());
      const betCall = fetchMock.mock.calls.find((call) => call[0] === '/backend/bets')!;
      const [, init] = betCall as [string, RequestInit];
      expect(JSON.parse(init.body as string)).toEqual({
        selections: [homeSelection],
        stakeCents: 300,
        useFreebets: true,
      });
    });

    it('never shows a campaign qualification note in freebet mode, even for an otherwise-qualifying bet', async () => {
      const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const method = init?.method ?? 'GET';
        if (method === 'GET' && url === '/backend/freebets') {
          return new Response(
            JSON.stringify([{ id: 'grant-1', amountCents: 1000, remainingCents: 1000, expiresAt: null }]),
            { status: 200 },
          );
        }
        if (method === 'GET' && url === '/backend/wallet') {
          return new Response(JSON.stringify({ balanceCents: 100000 }), { status: 200 });
        }
        if (method === 'GET' && url === '/backend/public/acca-boost-config/brand-1') {
          return new Response(
            JSON.stringify({ boostPercentPerLeg: 0, minSelections: 99, minOddsPerLeg: 1, enabled: false }),
            { status: 200 },
          );
        }
        if (method === 'POST' && url === '/backend/public/campaign-preview/brand-1') {
          // Mirrors PamService.previewCampaign's own gate - null out the
          // campaign whenever useFreebets is set on the request, same as
          // the real backend does, so this test exercises the actual
          // request/response contract rather than a hand-picked fixture.
          const body = JSON.parse(init!.body as string);
          return new Response(
            JSON.stringify(
              body.useFreebets
                ? {
                    betAndGetCampaignName: null,
                    betAndGetCampaignRewardCents: null,
                    depositCampaignName: null,
                    depositCampaignRewardCents: null,
                    registerCampaignName: null,
                    registerCampaignRewardCents: null,
                  }
                : {
                    betAndGetCampaignName: 'CL Bet & Get',
                    betAndGetCampaignRewardCents: 1000,
                    depositCampaignName: null,
                    depositCampaignRewardCents: null,
                    registerCampaignName: null,
                    registerCampaignRewardCents: null,
                  },
            ),
            { status: 200 },
          );
        }
        return new Response(null, { status: 404 });
      });
      vi.stubGlobal('fetch', fetchMock);
      useBetSlipStore.setState({ selections: [homeSelection] });
      renderPanel();

      await screen.findByText('🎁 Qualifies for CL Bet & Get', { exact: false });
      await userEvent.click(screen.getByRole('switch', { name: 'Pay with freebets' }));

      await waitFor(() => expect(screen.queryByText(/Qualifies for/)).not.toBeInTheDocument());
      const previewCall = fetchMock.mock.calls
        .filter((call) => call[0] === '/backend/public/campaign-preview/brand-1')
        .at(-1)!;
      const [, init] = previewCall as [string, RequestInit];
      expect(JSON.parse(init.body as string)).toMatchObject({ useFreebets: true });
    });

    it('hides the Acca Boost bar in freebet mode even for a qualifying accumulator', async () => {
      stubFreebetsAndAccaBoost(
        [{ id: 'grant-1', amountCents: 1000, remainingCents: 1000, expiresAt: null }],
        { boostPercentPerLeg: 5, minSelections: 2, minOddsPerLeg: 1.2, enabled: true },
      );
      useBetSlipStore.setState({ selections: [homeSelection, awaySelection] });
      renderPanel();

      expect(await screen.findByText(/Acca Boost/)).toBeInTheDocument();

      await userEvent.click(screen.getByRole('switch', { name: 'Pay with freebets' }));

      expect(screen.queryByText(/Acca Boost/)).not.toBeInTheDocument();
    });

    it('stays in freebet mode when switching to Singles with 2+ selections - freebets can fund several bets at once, unlike the old fixed-token model', async () => {
      stubFreebetsAndAccaBoost([{ id: 'grant-1', amountCents: 1000, remainingCents: 1000, expiresAt: null }]);
      useBetSlipStore.setState({ selections: [homeSelection, awaySelection] });
      renderPanel();

      await userEvent.click(await screen.findByRole('switch', { name: 'Pay with freebets' }));
      expect(screen.getByRole('switch', { name: 'Pay with freebets' })).toHaveAttribute('aria-checked', 'true');

      await userEvent.click(screen.getByRole('tab', { name: 'Singles' }));

      expect(screen.getByRole('switch', { name: 'Pay with freebets' })).toHaveAttribute('aria-checked', 'true');
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

    await waitFor(() => expect(useBetPlacedModalStore.getState().summary).not.toBeNull());
    expect(useBetPlacedModalStore.getState().summary).toEqual({
      stakeCents: 1000,
      potentialPayoutCents: 5250,
      combinedOdds: 5.25,
      betCount: 1,
      betAndGetCampaignName: undefined,
      betAndGetCampaignRewardCents: undefined,
      depositCampaignName: undefined,
      depositCampaignRewardCents: undefined,
      bet: {
        id: 'bet-1',
        stakeCents: 1000,
        combinedOdds: '5.25',
        potentialPayoutCents: 5250,
        status: 'PENDING',
        createdAt: '2026-07-17T00:00:00Z',
      },
    });
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

  it('opens the insufficient-funds modal instead of just showing inline error text when a cash bet exceeds the balance', async () => {
    useAuthStore.setState({
      accessToken: 'header.payload.signature',
      user: null,
      isInitialized: true,
    });
    useBetSlipStore.setState({ selections: [homeSelection, awaySelection] });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url === '/backend/freebets') {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        if (url === '/backend/bets') {
          return new Response(JSON.stringify({ message: 'Insufficient balance' }), { status: 400 });
        }
        return new Response(null, { status: 404 });
      }),
    );

    renderPanel();

    const stakeInput = screen.getByLabelText('Stake');
    await userEvent.clear(stakeInput);
    await userEvent.type(stakeInput, '999999');
    await userEvent.click(screen.getByRole('button', { name: 'Place Bet' }));

    await waitFor(() => expect(useInsufficientFundsModalStore.getState().isOpen).toBe(true));
    expect(screen.queryByText('Insufficient balance')).not.toBeInTheDocument();
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

    await waitFor(() => expect(useBetPlacedModalStore.getState().summary).not.toBeNull());
    expect(useBetPlacedModalStore.getState().summary).toEqual({
      stakeCents: 2000,
      potentialPayoutCents: 4200,
      combinedOdds: null,
      betCount: 2,
      betAndGetCampaignName: null,
      betAndGetCampaignRewardCents: null,
      depositCampaignName: null,
      depositCampaignRewardCents: null,
      registerCampaignName: null,
      registerCampaignRewardCents: null,
    });
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

  describe('bet slip settings and quick stakes', () => {
    beforeEach(() => {
      useBetSlipSettingsStore.setState({ autoUpdateOdds: false, quickStakes: [5, 10, 25, 50] });
    });

    function stubWallet(balanceCents: number) {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = typeof input === 'string' ? input : input.toString();
          const method = init?.method ?? 'GET';
          if (method === 'GET' && url === '/backend/wallet') {
            return new Response(JSON.stringify({ balanceCents }), { status: 200 });
          }
          if (method === 'GET' && url === '/backend/freebets') {
            return new Response(JSON.stringify([]), { status: 200 });
          }
          return new Response(null, { status: 404 });
        }),
      );
    }

    it('opens the settings panel from the gear icon and closes it again', async () => {
      renderPanel();

      expect(screen.queryByText('Bet slip settings')).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Bet slip settings' }));
      expect(screen.getByText('Bet slip settings')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Close bet slip settings' }));
      expect(screen.queryByText('Bet slip settings')).not.toBeInTheDocument();
    });

    it('shows the configured quick-stake buttons under the stake field', () => {
      useBetSlipStore.setState({ selections: [homeSelection] });
      renderPanel();

      expect(screen.getByRole('button', { name: '5.00 €' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '10.00 €' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '25.00 €' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '50.00 €' })).toBeInTheDocument();
    });

    it('fills the stake field when a quick-stake button is clicked and the balance covers it', async () => {
      useAuthStore.setState({ accessToken: 'header.payload.signature', user: null, isInitialized: true });
      stubWallet(10000);
      useBetSlipStore.setState({ selections: [homeSelection] });
      renderPanel();

      await userEvent.click(await screen.findByRole('button', { name: '25.00 €' }));

      expect(screen.getByLabelText('Stake')).toHaveValue(25);
      expect(useInsufficientFundsModalStore.getState().isOpen).toBe(false);
    });

    it('opens the insufficient-funds modal instead of filling the field when a quick stake exceeds the cash balance', async () => {
      useAuthStore.setState({ accessToken: 'header.payload.signature', user: null, isInitialized: true });
      stubWallet(1000);
      useBetSlipStore.setState({ selections: [homeSelection] });
      renderPanel();

      await userEvent.click(await screen.findByRole('button', { name: '25.00 €' }));

      await waitFor(() => expect(useInsufficientFundsModalStore.getState().isOpen).toBe(true));
      // Unchanged from the default single-selection stake - the quick-stake click was rejected, not applied.
      expect(screen.getByLabelText('Stake')).toHaveValue(10);
    });

    it('does not gate quick-stake buttons on cash balance in freebet mode', async () => {
      useAuthStore.setState({ accessToken: 'header.payload.signature', user: null, isInitialized: true });
      useBrandStore.setState({ brandId: 'brand-1' });
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = typeof input === 'string' ? input : input.toString();
          const method = init?.method ?? 'GET';
          if (method === 'GET' && url === '/backend/wallet') {
            return new Response(JSON.stringify({ balanceCents: 0 }), { status: 200 });
          }
          if (method === 'GET' && url === '/backend/freebets') {
            return new Response(
              JSON.stringify([{ id: 'grant-1', amountCents: 10000, remainingCents: 10000, expiresAt: null }]),
              { status: 200 },
            );
          }
          if (method === 'GET' && url === '/backend/public/acca-boost-config/brand-1') {
            return new Response(
              JSON.stringify({ boostPercentPerLeg: 0, minSelections: 99, minOddsPerLeg: 1, enabled: false }),
              { status: 200 },
            );
          }
          return new Response(null, { status: 404 });
        }),
      );
      useBetSlipStore.setState({ selections: [homeSelection], stake: '1.00' });
      renderPanel();

      await userEvent.click(await screen.findByRole('switch', { name: 'Pay with freebets' }));
      await userEvent.click(screen.getByRole('button', { name: '25.00 €' }));

      expect(screen.getByLabelText('Stake')).toHaveValue(25);
      expect(useInsufficientFundsModalStore.getState().isOpen).toBe(false);
    });
  });

  describe('pre-placement odds re-check', () => {
    function matchFixture(homeOdds: number, awayOdds: number = 2.5) {
      return {
        id: 'match-1',
        sport: 'Football',
        country: 'England',
        competition: 'Premier League',
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea',
        kickoff: '2026-08-19T18:00:00Z',
        isLive: false,
        markets: [
          {
            id: 'match-result',
            name: 'Match Result',
            selections: [
              { id: 'home', name: 'Home', odds: homeOdds },
              { id: 'away', name: 'Away', odds: awayOdds },
              { id: 'draw', name: 'Draw', odds: 3.0 },
            ],
          },
        ],
      };
    }

    function stubPlacement({
      currentHomeOdds,
      onBetPlaced,
    }: {
      currentHomeOdds: number;
      onBetPlaced?: (body: { selections: { odds: number }[] }) => void;
    }) {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = typeof input === 'string' ? input : input.toString();
          const method = init?.method ?? 'GET';
          if (method === 'GET' && url === '/backend/freebets') {
            return new Response(JSON.stringify([]), { status: 200 });
          }
          if (method === 'GET' && url === '/backend/public/matches/brand-1/match-1') {
            return new Response(JSON.stringify(matchFixture(currentHomeOdds)), { status: 200 });
          }
          if (method === 'POST' && url === '/backend/bets') {
            const body = JSON.parse(init!.body as string);
            onBetPlaced?.(body);
            return new Response(
              JSON.stringify({
                id: 'bet-1',
                stakeCents: body.stakeCents,
                combinedOdds: String(body.selections[0].odds),
                potentialPayoutCents: Math.round(body.stakeCents * body.selections[0].odds),
                status: 'PENDING',
                createdAt: '2026-07-17T00:00:00Z',
              }),
              { status: 201 },
            );
          }
          return new Response(null, { status: 404 });
        }),
      );
    }

    beforeEach(() => {
      useAuthStore.setState({ accessToken: 'header.payload.signature', user: null, isInitialized: true });
      useBrandStore.setState({ brandId: 'brand-1' });
      useBetSlipSettingsStore.setState({ autoUpdateOdds: false, quickStakes: [5, 10, 25, 50] });
    });

    it('places the bet straight away when the live price matches what is shown', async () => {
      const onBetPlaced = vi.fn();
      stubPlacement({ currentHomeOdds: 2.1, onBetPlaced });
      useBetSlipStore.setState({ selections: [homeSelection] });
      renderPanel();

      await userEvent.click(screen.getByRole('button', { name: 'Place Bet' }));

      await waitFor(() => expect(onBetPlaced).toHaveBeenCalled());
      expect(onBetPlaced.mock.calls[0]![0].selections[0].odds).toBe(2.1);
      expect(screen.queryByText(/odds have changed/)).not.toBeInTheDocument();
    });

    it('blocks placement and shows an alert with the updated price when auto-update-odds is off', async () => {
      const onBetPlaced = vi.fn();
      stubPlacement({ currentHomeOdds: 1.8, onBetPlaced });
      useBetSlipStore.setState({ selections: [homeSelection] });
      renderPanel();

      await userEvent.click(screen.getByRole('button', { name: 'Place Bet' }));

      expect(await screen.findByText(/odds have changed/)).toBeInTheDocument();
      expect(onBetPlaced).not.toHaveBeenCalled();
      // The slip now shows the real current price, not the stale one that was clicked.
      expect(useBetSlipStore.getState().selections[0]!.odds).toBe(1.8);

      // Trying again now succeeds - the displayed price is the real one.
      await userEvent.click(screen.getByRole('button', { name: 'Place Bet' }));
      await waitFor(() => expect(onBetPlaced).toHaveBeenCalled());
      expect(onBetPlaced.mock.calls[0]![0].selections[0].odds).toBe(1.8);
    });

    it('auto-places at the new price when auto-update-odds is on, with no alert', async () => {
      useBetSlipSettingsStore.setState({ autoUpdateOdds: true });
      const onBetPlaced = vi.fn();
      stubPlacement({ currentHomeOdds: 2.4, onBetPlaced });
      useBetSlipStore.setState({ selections: [homeSelection] });
      renderPanel();

      await userEvent.click(screen.getByRole('button', { name: 'Place Bet' }));

      await waitFor(() => expect(onBetPlaced).toHaveBeenCalled());
      expect(onBetPlaced.mock.calls[0]![0].selections[0].odds).toBe(2.4);
      expect(screen.queryByText(/odds have changed/)).not.toBeInTheDocument();
    });

    it('re-checks every selection in an accumulator and blocks placement if any one price moved', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = typeof input === 'string' ? input : input.toString();
          const method = init?.method ?? 'GET';
          if (method === 'GET' && url === '/backend/freebets') {
            return new Response(JSON.stringify([]), { status: 200 });
          }
          if (method === 'GET' && url === '/backend/public/matches/brand-1/match-1') {
            return new Response(JSON.stringify(matchFixture(2.1)), { status: 200 });
          }
          if (method === 'GET' && url === '/backend/public/matches/brand-1/match-2') {
            // Away side of match-2 moved from 2.5 to 2.9.
            return new Response(JSON.stringify(matchFixture(1.5, 2.9)), { status: 200 });
          }
          if (method === 'GET' && url === '/backend/public/acca-boost-config/brand-1') {
            return new Response(
              JSON.stringify({ boostPercentPerLeg: 0, minSelections: 99, minOddsPerLeg: 1, enabled: false }),
              { status: 200 },
            );
          }
          if (method === 'POST' && url === '/backend/bets') {
            return new Response(null, { status: 500 });
          }
          return new Response(null, { status: 404 });
        }),
      );
      useBetSlipStore.setState({ selections: [homeSelection, awaySelection] });
      renderPanel();

      await userEvent.click(await screen.findByRole('button', { name: 'Place Bet' }));

      expect(await screen.findByText(/odds have changed/)).toBeInTheDocument();
      expect(useBetSlipStore.getState().selections[1]!.odds).toBe(2.9);
    });
  });
});
