import { useEffect, useId, useRef, useState, type ReactNode, type SVGProps } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CampaignRewardAlert } from '../../components/ui/CampaignRewardAlert';
import { EmptyState } from '../../components/ui/EmptyState';
import { MoneyBeforeAfter } from '../../components/ui/MoneyBeforeAfter';
import { Switch } from '../../components/ui/Switch';
import { cn } from '../../lib/cn';
import { track } from '../../lib/analytics';
import { placeBet } from '../../lib/backendApi';
import { formatMoney } from '../../lib/currency';
import { useAuth } from '../auth/useAuth';
import { useAuthModalStore } from '../auth/authModalStore';
import { useWallet, walletQueryKey } from '../wallet/useWallet';
import { freebetsQueryKey, sumFreebetsCents, useFreebets } from '../wallet/useFreebets';
import { BalancePills } from '../wallet/BalancePills';
import { useInsufficientFundsModalStore } from '../wallet/insufficientFundsModalStore';
import { betsQueryKey } from '../bet-history/useBets';
import { BetHistoryList } from '../bet-history/BetHistoryList';
import { useBetPlacedModalStore } from './betPlacedModalStore';
import { calculateAccaBoost, type AccaBoostConfig } from './accaBoost';
import { useAccaBoostConfig } from './useAccaBoostConfig';
import { evaluateAccaRollbackEligibility, type AccaRollbackConfig } from './accaRollback';
import { useAccaRollbackConfig } from './useAccaRollbackConfig';
import { calculateInsuredPayout } from './insuranceBet';
import { useInsuranceBetConfig } from './useInsuranceBetConfig';
import { useStakeLimitPreview } from './useStakeLimitPreview';
import { useCampaignPreview } from './useCampaignPreview';
import { hasInsuranceIneligibleSelection, hasSameEventSelections, invalidAccumulatorReason } from './accumulatorValidity';
import {
  getSingleStake as getSingleStakeFromStore,
  selectionKey,
  useBetSlipStore,
  type BetSlipSelection,
} from './betSlipStore';
import type { CampaignPreview, StakeLimitPreview } from '../../lib/backendApi';

type PayMethod = 'cash' | 'freebet';

type BetSlipTab = 'singles' | 'accumulator';
type PanelView = 'slip' | 'history';

function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M4 6h12" />
      <path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h1A1.5 1.5 0 0 1 12 4.5V6" />
      <path d="M5.5 6 6.2 16a1 1 0 0 0 1 .9h5.6a1 1 0 0 0 1-.9L14.5 6" />
      <line x1="8.3" y1="9" x2="8.6" y2="14" />
      <line x1="11.7" y1="9" x2="11.4" y2="14" />
    </svg>
  );
}

/**
 * Plain odds, or - when originalOdds is set (see BoostService.applyBoosts) -
 * the struck-through original price, an arrow, then the boosted price. Same
 * strikethrough/arrow/highlight-value visual as BoostedOddsRow (the Boosts
 * page and match detail page's Boosts section), so a boosted selection
 * reads identically wherever it appears.
 */
function SelectionOdds({ selection }: { selection: BetSlipSelection }) {
  if (selection.originalOdds === undefined) {
    return <span className="font-semibold">{selection.odds.toFixed(2)}</span>;
  }
  return (
    <span className="flex items-center gap-2">
      <span className="prev-odds text-xs font-semibold line-through decoration-1">
        {selection.originalOdds.toFixed(2)}
      </span>
      <span className="text-text-secondary" aria-hidden="true">
        &rarr;
      </span>
      <span className="font-semibold text-highlight">{selection.odds.toFixed(2)}</span>
    </span>
  );
}

/**
 * Only rendered when a per-bet stake cap applies - either a boost's price cap
 * (see BoostService.applyBoosts) or a manual market's own trader-configured
 * cap (see ManualMarketService). Wording distinguishes the two since only one
 * involves a boosted price.
 */
function MaxStakeNote({ selection }: { selection: BetSlipSelection }) {
  if (selection.maxStakeCents === undefined && !selection.marketSinglesOnly) {
    return null;
  }
  const label = selection.originalOdds !== undefined ? 'Max stake for boosted price' : 'Max stake';
  const parts: string[] = [];
  if (selection.maxStakeCents !== undefined) {
    parts.push(`${label}: ${formatMoney(selection.maxStakeCents)}`);
  }
  if (selection.marketSinglesOnly) {
    parts.push('Singles only');
  }
  return <p className="text-[11px] text-text-secondary">{parts.join(' · ')}</p>;
}

/**
 * Only rendered for the accumulator tab - singles never qualify (see
 * calculateAccaBoost's minSelections gate). Three states: not enough
 * selections yet (progress bar toward the threshold), enough selections but
 * a leg's price is too short to qualify, or qualifying (bar full, shows the
 * live boost % and, once a stake is typed in, what that boost is actually
 * worth - the previous vs. boosted potential payout, not just the percent).
 */
function AccaBoostBar({
  legOdds,
  config,
  stakeCents,
}: {
  legOdds: number[];
  config: AccaBoostConfig;
  stakeCents: number;
}) {
  if (!config.enabled) {
    return null;
  }

  const result = calculateAccaBoost(legOdds, config);

  if (result.qualifies) {
    return (
      <div className="space-y-1.5 rounded-xl border border-highlight/40 bg-highlight/10 p-2.5">
        <div className="flex items-center justify-between gap-2 text-xs font-semibold">
          <span className="text-highlight">🚀 Acca Boost +{result.boostPercent}%</span>
          <span className="text-text-muted">+{config.boostPercentPerLeg}% for 1 more selection</span>
        </div>
        {stakeCents > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-secondary">Potential payout</span>
            <MoneyBeforeAfter
              beforeCents={Math.round(stakeCents * result.baseCombinedOdds)}
              afterCents={Math.round(stakeCents * result.boostedCombinedOdds)}
            />
          </div>
        )}
        <div className="h-1.5 overflow-hidden rounded-full bg-surface">
          <div className="h-full w-full rounded-full bg-highlight" />
        </div>
      </div>
    );
  }

  const belowMinOdds = legOdds.length > 0 && legOdds.some((odds) => odds < config.minOddsPerLeg);
  if (belowMinOdds) {
    return (
      <div className="rounded-xl border border-border bg-surface-2 p-2.5 text-xs text-text-muted">
        Every selection needs odds of at least {config.minOddsPerLeg.toFixed(2)} to qualify for Acca
        Boost.
      </div>
    );
  }

  const remaining = Math.max(0, config.minSelections - legOdds.length);
  const progressPercent = Math.min(100, Math.round((legOdds.length / config.minSelections) * 100));
  return (
    <div className="space-y-1.5 rounded-xl border border-border bg-surface-2 p-2.5">
      <p className="text-xs font-medium text-text-secondary">
        Add {remaining} more selection{remaining === 1 ? '' : 's'} to unlock Acca Boost
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface">
        <div
          className="h-full rounded-full bg-highlight transition-all"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Only rendered for the accumulator tab - the reward itself depends on how
 * many legs end up losing, which is unknowable until settlement, so this
 * only ever shows whether the bet currently has enough legs to be in the
 * running ("will qualify") or how many more it needs.
 */
function AccaRollbackBar({ selectionCount, config }: { selectionCount: number; config: AccaRollbackConfig }) {
  if (!config.enabled) {
    return null;
  }

  const { qualifies } = evaluateAccaRollbackEligibility(selectionCount, config);

  if (qualifies) {
    return (
      <div className="rounded-xl border border-highlight/40 bg-highlight/10 p-2.5 text-xs font-semibold text-highlight">
        🛡️ Will qualify for Acca Rollback - get {config.rewardPercent}% back as a freebet if it loses by
        no more than {config.lossThreshold} selection{config.lossThreshold === 1 ? '' : 's'}
      </div>
    );
  }

  const remaining = Math.max(0, config.minSelections - selectionCount);
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-2.5 text-xs font-medium text-text-secondary">
      Add {remaining} more selection{remaining === 1 ? '' : 's'} to qualify for Acca Rollback
    </div>
  );
}

/**
 * Previews what PamService.assertWithinStakeLimits (see the
 * /public/stake-limit-preview endpoint) would allow for this exact bet.
 * `null` (still loading, no brand resolved yet, or no cap configured at
 * all) renders nothing - never a fabricated limit. Within the cap it's a
 * quiet informational note matching MaxStakeNote's style; once the typed
 * stake exceeds it, it becomes a warning naming which cap (stake vs
 * liability) is the binding one, so the player sees the problem before
 * the place-bet request would just get rejected for it.
 */
function StakeLimitAlert({ stakeCents, preview }: { stakeCents: number; preview: StakeLimitPreview | null }) {
  if (!preview || preview.effectiveMaxStakeCents === null) {
    return null;
  }

  const maxStakeLabel = formatMoney(preview.effectiveMaxStakeCents);
  if (stakeCents <= preview.effectiveMaxStakeCents) {
    return <p className="text-[11px] text-text-secondary">Max stake for this bet: {maxStakeLabel}</p>;
  }

  // effectiveMaxStakeCents is whichever of the two caps is smaller (see
  // maxStakeFromLiability) - if the plain stake cap matches it, that's the
  // binding one, otherwise the liability-derived cap must be.
  const reason = preview.maxStakeCents === preview.effectiveMaxStakeCents ? 'stake limit' : 'liability limit';
  return (
    <p className="rounded-xl border border-danger/40 bg-danger/10 px-2.5 py-2 text-xs font-medium text-danger">
      Stake exceeds the maximum allowed for this bet (max {maxStakeLabel}, {reason})
    </p>
  );
}

/**
 * Previews which campaign(s) PamService.placeBet would actually link this
 * bet to (see /public/campaign-preview and useCampaignPreview) - shown
 * before the player places the bet. A bet can qualify for a Bet & Get
 * campaign and fulfil a pending deposit campaign redemption at once (they're
 * independent), so both render when both apply. Renders nothing while
 * loading or when neither applies - never a fabricated qualification.
 */
function CampaignQualificationNote({ preview }: { preview: CampaignPreview | null }) {
  if (!preview) {
    return null;
  }
  const notes = [
    { name: preview.betAndGetCampaignName, rewardCents: preview.betAndGetCampaignRewardCents },
    { name: preview.depositCampaignName, rewardCents: preview.depositCampaignRewardCents },
    { name: preview.registerCampaignName, rewardCents: preview.registerCampaignRewardCents },
  ].filter((note): note is { name: string; rewardCents: number | null } => note.name !== null);

  if (notes.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1.5">
      {notes.map((note) => (
        <CampaignRewardAlert key={note.name} name={note.name} rewardCents={note.rewardCents} />
      ))}
    </div>
  );
}

interface StakeFieldProps {
  stakeId: string;
  stake: string;
  onStakeChange: (value: string) => void;
  odds: number;
  /**
   * A single-bet row already shows its own odds up in the header, right
   * next to the remove button - repeating it again next to the stake input
   * read as "the odds, twice" for no reason. The accumulator has no
   * equivalent header, so its one combined odds figure belongs here.
   */
  hideOdds?: boolean;
  /** Set to the pre-boost combined odds when the accumulator qualifies for Acca Boost, so the player sees what changed, not just the end result. */
  previousOdds?: number;
  /**
   * Set when accumulatorInvalidReason applies (e.g. two selections from the
   * same event) - a "combined odds" figure would still be arithmetically
   * computable here, but showing a real number implies a price that will
   * never actually be offered. A slash reads as "not a real price" rather
   * than a wrong one, and takes priority over previousOdds.
   */
  invalid?: boolean;
}

/**
 * Just the stake input, optionally paired with its odds - always visible
 * and editable regardless of login state, so a player can see what they'd
 * win before ever signing in. Potential payout is deliberately not part of
 * this component: the accumulator shows one payout for its one stake, but
 * singles share a single payout total in the footer instead of repeating a
 * payout line under every row - see the two `footer` branches below.
 */
function StakeField({ stakeId, stake, onStakeChange, odds, hideOdds, previousOdds, invalid }: StakeFieldProps) {
  return (
    <div className="flex items-end gap-2">
      <div className="min-w-0 flex-1">
        <label htmlFor={stakeId} className="block text-xs text-text-secondary">
          Stake
        </label>
        <input
          id={stakeId}
          type="number"
          min="0.01"
          step="0.01"
          value={stake}
          onChange={(event) => onStakeChange(event.target.value)}
          className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-base sm:text-sm"
        />
      </div>
      {!hideOdds && (
        // Always the gold "selected" shape, not just the plain default box -
        // this is the one live combined-price figure for the bet being
        // built, so it should always read as the same "this is the real
        // price" gold pill an odd reads as once picked (see .odd-btn.selected
        // in index.css), never the neutral/unselected look.
        <span className="odd-btn selected shrink-0">
          <span className="odd-label">Odds</span>
          {invalid ? (
            <span className="odd-value" aria-label="Odds not combinable">
              /
            </span>
          ) : previousOdds !== undefined ? (
            <span className="flex items-center gap-1.5">
              <span className="prev-odds text-xs line-through decoration-1">
                {previousOdds.toFixed(2)}
              </span>
              <span className="odd-value text-highlight">{odds.toFixed(2)}</span>
            </span>
          ) : (
            <span className="odd-value">{odds.toFixed(2)}</span>
          )}
        </span>
      )}
    </div>
  );
}

interface SingleBetRowProps {
  selection: BetSlipSelection;
  stake: string;
  onStakeChange: (value: string) => void;
  /**
   * false when this is the only selection in the slip - its stake field
   * moves to the shared fixed footer instead (see the footer branch below),
   * matching the reference design where a lone selection's amount box sits
   * above the Place Bet button, not attached to the selection card. With
   * 2+ singles each row still needs its own inline stake, since "place all
   * together" needs every row's amount at once.
   */
  showStake: boolean;
  /** Mirrors PlaceBetDto.insuranceOptIn - an insured bet never links to a campaign, so this row's own qualification preview must agree. */
  insuranceOptIn: boolean;
  /** Mirrors PlaceBetDto.useFreebets - a freebet-funded bet never links to a campaign, so this row's own qualification preview must agree. */
  isFreebetMode: boolean;
}

/**
 * Purely presentational now - its stake lives in the parent (see
 * `singleStakes` on BetSlipPanel) because placing "all singles together"
 * needs every row's stake at once. No place-bet button of its own: there's
 * exactly one, fixed at the bottom of the panel, regardless of how many
 * rows there are.
 */
function SingleBetRow({ selection, stake, onStakeChange, showStake, insuranceOptIn, isFreebetMode }: SingleBetRowProps) {
  const removeSelection = useBetSlipStore((state) => state.removeSelection);
  const stakeId = useId();
  const stakeLimitPreview = useStakeLimitPreview([selection]);
  const campaignPreview = useCampaignPreview(
    [selection],
    Math.round(Number(stake) * 100),
    insuranceOptIn,
    isFreebetMode,
  );

  return (
    <Card className="fade-in-up space-y-2 border-border bg-surface-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-text-muted">{selection.matchLabel}</p>
          <p className="text-sm font-medium">
            {selection.marketName}: {selection.selectionName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SelectionOdds selection={selection} />
          <button
            type="button"
            aria-label={`Remove ${selection.selectionName} for ${selection.matchLabel}`}
            className="text-text-muted hover:text-danger"
            onClick={() => removeSelection(selection.matchId, selection.marketId)}
          >
            ✕
          </button>
        </div>
      </div>

      <MaxStakeNote selection={selection} />

      {showStake && (
        <>
          <StakeField
            stakeId={stakeId}
            stake={stake}
            onStakeChange={onStakeChange}
            odds={selection.odds}
            hideOdds
          />
          <StakeLimitAlert stakeCents={Math.round(Number(stake) * 100)} preview={stakeLimitPreview} />
          <CampaignQualificationNote preview={campaignPreview} />
        </>
      )}
    </Card>
  );
}

function CompactEmptyState() {
  return <p className="text-sm text-text-secondary">Your bet slip is empty.</p>;
}

/** Desktop's persistent panel is never "just gone" - fills the available height and nudges toward browsing instead of sitting blank. */
function PromotionalEmptyState() {
  return (
    <EmptyState
      title="Add selections to your bet slip"
      description="Pick an odd on any match to start building a bet."
      ctaLabel="Browse matches"
      ctaHref="/"
    />
  );
}

export interface BetSlipPanelProps {
  /** Desktop's persistent panel only - the mobile drawer skips this in favor of its own bottom-nav "My Bets" link/page. */
  showHistoryTab?: boolean;
  /** 'promotional' is the fuller, full-height, CTA-driven empty state used by the desktop persistent panel. */
  emptyStateVariant?: 'compact' | 'promotional';
}

export function BetSlipPanel({
  showHistoryTab = false,
  emptyStateVariant = 'compact',
}: BetSlipPanelProps = {}) {
  const selections = useBetSlipStore((state) => state.selections);
  const removeSelection = useBetSlipStore((state) => state.removeSelection);
  const clear = useBetSlipStore((state) => state.clear);
  const { isAuthenticated } = useAuth();
  const openAuthModal = useAuthModalStore((state) => state.open);
  const accaBoostConfig = useAccaBoostConfig();
  const accaRollbackConfig = useAccaRollbackConfig();
  const insuranceBetConfig = useInsuranceBetConfig();
  const { data: freebets } = useFreebets();
  const hasFreebets = Boolean(freebets && freebets.length > 0);
  const { data: wallet } = useWallet();
  const queryClient = useQueryClient();
  const stake = useBetSlipStore((state) => state.stake);
  const setStake = useBetSlipStore((state) => state.setStake);
  const [payMethod, setPayMethod] = useState<PayMethod>('cash');
  const [insuranceOptIn, setInsuranceOptIn] = useState(false);
  // Keyed by selectionKey() - each single-bet row's own stake, entered
  // independently of every other row but all placed together by the one
  // bottom button (see placeSinglesMutation below).
  const singleStakes = useBetSlipStore((state) => state.singleStakes);
  const setSingleStake = useBetSlipStore((state) => state.setSingleStake);
  const openBetPlacedModal = useBetPlacedModalStore((state) => state.open);
  const [panelView, setPanelView] = useState<PanelView>('slip');
  // Fresh per mount (the mobile drawer remounts this on every open), so a
  // slip with 2+ selections always opens straight to Accumulator - unless
  // those selections can't actually be combined (same event, different
  // markets - see hasSameEventSelections), in which case Singles is the
  // only tab that makes sense.
  const [activeTab, setActiveTab] = useState<BetSlipTab>(() =>
    selections.length >= 2 && !hasSameEventSelections(selections) ? 'accumulator' : 'singles',
  );
  // Desktop mounts this once and keeps it mounted (no per-open remount like
  // the mobile drawer), so the initializer above only fires once - jump to
  // Accumulator specifically on the 1->2+ transition instead, without
  // fighting a manual switch back to Singles once already at 2+. Similarly,
  // jump back to Singles the instant a same-event conflict newly appears
  // (e.g. the player just added a second market on a match already in the
  // slip) - but only on that transition, not on every render, so the player
  // can still manually flip back to Accumulator afterward to see why Place
  // Bet is disabled there (see accumulatorInvalidReason in the footer).
  const hadMultipleSelectionsRef = useRef(selections.length >= 2);
  const hadSameEventConflictRef = useRef(hasSameEventSelections(selections));
  useEffect(() => {
    const hasMultipleNow = selections.length >= 2;
    const sameEventConflictNow = hasSameEventSelections(selections);
    if (hasMultipleNow && !hadMultipleSelectionsRef.current && !sameEventConflictNow) {
      setActiveTab('accumulator');
    }
    if (sameEventConflictNow && !hadSameEventConflictRef.current) {
      setActiveTab('singles');
    }
    hadMultipleSelectionsRef.current = hasMultipleNow;
    hadSameEventConflictRef.current = sameEventConflictNow;
  }, [selections]);
  // Insurance never applies alongside a freebet-funded bet, to avoid
  // double-bonusing (same rule acca boost/rollback follow) - drop it the
  // moment the player switches into freebet mode rather than silently
  // ignoring an opt-in they can still see checked.
  useEffect(() => {
    if (payMethod === 'freebet' && insuranceOptIn) {
      setInsuranceOptIn(false);
    }
  }, [payMethod, insuranceOptIn]);
  // A boosted price or a singles-only special is already priced with its
  // own subsidy/no-correlation assumption (see PamService.assertInsuranceEligible) -
  // drop insurance the moment such a selection enters the slip, same as the
  // freebet-mode reset above.
  const insuranceIneligible = hasInsuranceIneligibleSelection(selections);
  useEffect(() => {
    if (insuranceIneligible && insuranceOptIn) {
      setInsuranceOptIn(false);
    }
  }, [insuranceIneligible, insuranceOptIn]);
  const stakeId = useId();

  function getSingleStake(selection: BetSlipSelection): string {
    return getSingleStakeFromStore(singleStakes, selection);
  }

  const isFreebetMode = payMethod === 'freebet';
  const insuranceApplies = insuranceOptIn && insuranceBetConfig.enabled;

  function resetPayMethod() {
    setPayMethod('cash');
    setInsuranceOptIn(false);
  }

  const placeAccumulatorMutation = useMutation({
    mutationFn: placeBet,
    onSuccess: (bet) => {
      track('BET_PLACED', {
        metadata: { stakeCents: bet.stakeCents, selectionCount: selections.length, mode: 'accumulator' },
      });
      clear();
      resetPayMethod();
      openBetPlacedModal({
        stakeCents: bet.stakeCents,
        potentialPayoutCents: bet.potentialPayoutCents,
        combinedOdds: Number(bet.combinedOdds),
        betCount: 1,
        betAndGetCampaignName: bet.betAndGetCampaignName,
        betAndGetCampaignRewardCents: bet.betAndGetCampaignRewardCents,
        depositCampaignName: bet.depositCampaignName,
        depositCampaignRewardCents: bet.depositCampaignRewardCents,
        registerCampaignName: bet.registerCampaignName,
        registerCampaignRewardCents: bet.registerCampaignRewardCents,
        bet,
      });
      void queryClient.invalidateQueries({ queryKey: walletQueryKey });
      void queryClient.invalidateQueries({ queryKey: betsQueryKey });
      void queryClient.invalidateQueries({ queryKey: freebetsQueryKey });
    },
  });

  /**
   * Places every single-bet row's own stake as its own separate bet, all at
   * once from the one bottom button - each draws from the freebets pool
   * instead of cash when isFreebetMode, same as the accumulator tab, since
   * freebets act as a second wallet rather than a one-bet-only token.
   */
  const placeSinglesMutation = useMutation({
    mutationFn: async () => {
      return Promise.all(
        selections.map((selection) => {
          const stakeCents = Math.round(Number(getSingleStake(selection)) * 100);
          return placeBet({
            selections: [selection],
            stakeCents,
            useFreebets: isFreebetMode || undefined,
            insuranceOptIn: isFreebetMode ? undefined : insuranceOptIn,
          });
        }),
      );
    },
    onSuccess: (bets) => {
      clear();
      resetPayMethod();
      const totalStakeCents = bets.reduce((total, bet) => total + bet.stakeCents, 0);
      const totalPayoutCents = bets.reduce((total, bet) => total + bet.potentialPayoutCents, 0);
      track('BET_PLACED', {
        metadata: { stakeCents: totalStakeCents, selectionCount: bets.length, mode: 'singles' },
      });
      const betAndGetBet = bets.find((bet) => bet.betAndGetCampaignName !== null);
      const depositCampaignBet = bets.find((bet) => bet.depositCampaignName !== null);
      const registerCampaignBet = bets.find((bet) => bet.registerCampaignName !== null);
      openBetPlacedModal({
        stakeCents: totalStakeCents,
        potentialPayoutCents: totalPayoutCents,
        combinedOdds: bets.length === 1 ? Number(bets[0]!.combinedOdds) : null,
        betCount: bets.length,
        betAndGetCampaignName: betAndGetBet?.betAndGetCampaignName ?? null,
        betAndGetCampaignRewardCents: betAndGetBet?.betAndGetCampaignRewardCents ?? null,
        depositCampaignName: depositCampaignBet?.depositCampaignName ?? null,
        depositCampaignRewardCents: depositCampaignBet?.depositCampaignRewardCents ?? null,
        registerCampaignName: registerCampaignBet?.registerCampaignName ?? null,
        registerCampaignRewardCents: registerCampaignBet?.registerCampaignRewardCents ?? null,
        bet: bets.length === 1 ? bets[0] : undefined,
      });
      void queryClient.invalidateQueries({ queryKey: walletQueryKey });
      void queryClient.invalidateQueries({ queryKey: betsQueryKey });
      void queryClient.invalidateQueries({ queryKey: freebetsQueryKey });
    },
  });

  const openInsufficientFundsModal = useInsufficientFundsModalStore((state) => state.open);
  // A dedicated popup rather than the usual inline error text - "Insufficient
  // balance" is the one placement failure with an obvious next step (add
  // funds), so it gets a CTA instead of just a red line of text. Mounted at
  // AppShell level (see insufficientFundsModalStore) since BetSlipPanel can
  // itself be nested inside the mobile bet slip's own animated sheet.
  useEffect(() => {
    const activeError = tab === 'accumulator' ? placeAccumulatorMutation.error : placeSinglesMutation.error;
    if (activeError instanceof Error && activeError.message === 'Insufficient balance') {
      openInsufficientFundsModal();
    }
  }, [placeAccumulatorMutation.error, placeSinglesMutation.error]);

  const showTabs = selections.length >= 2;
  const tab: BetSlipTab = showTabs ? activeTab : 'singles';
  // A lone selection has nowhere else for its stake to live once it's not
  // inline on the row (see SingleBetRow's showStake) - computed up here
  // (not inside the branch below) since the stake-limit preview hooks
  // that use it must be called unconditionally on every render.
  const singleSelection = selections.length === 1 ? selections[0] : undefined;
  // Only meaningful for the accumulator tab - singles never combine
  // selections, so neither rule this checks can ever apply there.
  const accumulatorInvalidReason = tab === 'accumulator' ? invalidAccumulatorReason(selections) : null;
  const accumulatorStakeLimitPreview = useStakeLimitPreview(tab === 'accumulator' ? selections : []);
  const singleSelectionStakeLimitPreview = useStakeLimitPreview(singleSelection ? [singleSelection] : []);
  const rawAccaBoost = calculateAccaBoost(
    selections.map((selection) => selection.odds),
    accaBoostConfig,
  );
  // Freebets and an insured bet never combine with acca boost, to avoid
  // double-bonusing the same bet - force it off regardless of whether this
  // accumulator would otherwise qualify (see calculateAccaBoost). Mirrors
  // PamService.placeBet's insuranceApplies gate.
  const accaBoost =
    isFreebetMode || insuranceApplies
      ? { qualifies: false, boostPercent: 0, baseCombinedOdds: rawAccaBoost.baseCombinedOdds, boostedCombinedOdds: rawAccaBoost.baseCombinedOdds }
      : rawAccaBoost;
  // The un-boosted product passes straight through when the accumulator doesn't qualify (see calculateAccaBoost).
  const combinedOdds = accaBoost.boostedCombinedOdds;
  const stakeCents = Math.round(Number(stake) * 100);
  const isStakeValid = Number.isFinite(stakeCents) && stakeCents > 0;
  const accumulatorCampaignPreview = useCampaignPreview(
    tab === 'accumulator' ? selections : [],
    stakeCents,
    insuranceOptIn,
    isFreebetMode,
  );
  const singleSelectionCampaignPreview = useCampaignPreview(
    singleSelection ? [singleSelection] : [],
    singleSelection ? Math.round(Number(getSingleStake(singleSelection)) * 100) : 0,
    insuranceOptIn,
    isFreebetMode,
  );
  // Payout is always stake x odds (see PamService.settleSelection - a
  // freebet win credits the full stake x odds by default, per Brand.
  // freebetStakeReturnedOnWin), never a net-winnings figure.
  const rawPotentialCents = stakeCents * combinedOdds;
  // Insurance never applies in freebet mode (see the reset effect above) -
  // this always passes through unchanged there, same as calculateInsuredPayout would.
  const insurancePricing = calculateInsuredPayout(rawPotentialCents, insuranceOptIn, insuranceBetConfig);
  const potentialPayoutCents = insurancePricing.insuredPayoutCents;
  const potentialPayout = isStakeValid ? (potentialPayoutCents / 100).toFixed(2) : '—';
  const allSinglesValid =
    selections.length > 0 &&
    selections.every((selection) => {
      const cents = Math.round(Number(getSingleStake(selection)) * 100);
      return Number.isFinite(cents) && cents > 0;
    });
  // One payout total for all singles together, shown once in the footer -
  // each row already shows its own stake and odds, so repeating a payout
  // line under every row as well would just be more noise. Always stake x
  // odds, same as the accumulator's rawPotentialCents.
  const totalSinglesPayout = allSinglesValid
    ? (
        selections.reduce((total, selection) => {
          const stakeCentsForRow = Math.round(Number(getSingleStake(selection)) * 100);
          const rawCents = stakeCentsForRow * selection.odds;
          if (isFreebetMode) {
            return total + rawCents;
          }
          return total + calculateInsuredPayout(rawCents, insuranceOptIn, insuranceBetConfig).insuredPayoutCents;
        }, 0) / 100
      ).toFixed(2)
    : '—';
  // Uninsured total, for the "previous" side of the before/after display -
  // same shape as totalSinglesPayout's reduce but without the insurance
  // discount, and always computed (not gated on insuranceOptIn) so the
  // insurance toggle's own explanation can quote it before it's even on.
  const totalSinglesRawPayoutCents = allSinglesValid
    ? selections.reduce((total, selection) => {
        const stakeCentsForSelection = Math.round(Number(getSingleStake(selection)) * 100);
        return total + stakeCentsForSelection * selection.odds;
      }, 0)
    : 0;
  // What the singles total would be if insurance were opted into right now,
  // regardless of the actual toggle state - lets the toggle's explanation
  // quote a real number before the player switches it on.
  const totalSinglesInsuredPreviewCents = allSinglesValid
    ? selections.reduce((total, selection) => {
        const stakeCentsForSelection = Math.round(Number(getSingleStake(selection)) * 100);
        const rawCents = stakeCentsForSelection * selection.odds;
        return total + calculateInsuredPayout(rawCents, true, insuranceBetConfig).insuredPayoutCents;
      }, 0)
    : 0;
  // Same raw stake x odds figure the actual payout is derived from (see
  // insurancePricing above), but always previewed as if insurance were on -
  // used both for the toggle's explanatory copy and the before/after display.
  const accumulatorInsurancePreviewCents = calculateInsuredPayout(
    rawPotentialCents,
    true,
    insuranceBetConfig,
  ).insuredPayoutCents;
  const isCurrentTabValid = tab === 'accumulator' ? isStakeValid : allSinglesValid;
  const currentTabRawPayoutCents = tab === 'accumulator' ? rawPotentialCents : totalSinglesRawPayoutCents;
  const currentTabInsurancePreviewCents =
    tab === 'accumulator' ? accumulatorInsurancePreviewCents : totalSinglesInsuredPreviewCents;
  // A discounted price purely for display - insurance doesn't change the
  // actual market odds, only the payout, but showing it as an "effective"
  // odds figure (mirroring how a boost shows previous -> new) makes the
  // -X% cost legible right where the player is already looking at odds.
  const insuranceEffectiveCombinedOdds = insuranceApplies
    ? combinedOdds * (1 - insuranceBetConfig.costPercent / 100)
    : undefined;
  const insuranceEffectiveSingleOdds =
    insuranceApplies && singleSelection ? singleSelection.odds * (1 - insuranceBetConfig.costPercent / 100) : undefined;

  let mainContent: ReactNode;
  // Stake/payout/CTA lives outside the scrollable region (see the `footer`
  // return below) so it stays visible while a long selection list scrolls
  // underneath it - exactly one CTA regardless of tab or selection count.
  let footer: ReactNode = null;

  if (panelView === 'history') {
    mainContent = <BetHistoryList />;
  } else if (selections.length === 0) {
    mainContent = emptyStateVariant === 'promotional' ? <PromotionalEmptyState /> : <CompactEmptyState />;
  } else {
    mainContent = (
      <div className="space-y-3">
        {showTabs && (
          <div className="flex items-center justify-between border-b border-border">
            <div className="flex gap-4" role="tablist" aria-label="Bet slip mode">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'singles'}
                className={cn(
                  'border-b-2 pb-2 font-display text-sm font-bold tracking-wide italic',
                  tab === 'singles'
                    ? 'border-filter text-text-primary'
                    : 'border-transparent text-text-secondary hover:text-text-primary',
                )}
                onClick={() => setActiveTab('singles')}
              >
                Singles
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'accumulator'}
                className={cn(
                  'border-b-2 pb-2 font-display text-sm font-bold tracking-wide italic',
                  tab === 'accumulator'
                    ? 'border-filter text-text-primary'
                    : 'border-transparent text-text-secondary hover:text-text-primary',
                )}
                onClick={() => setActiveTab('accumulator')}
              >
                Accumulator ({selections.length})
              </button>
            </div>
            <button
              type="button"
              aria-label="Clear bet slip"
              className="mb-2 shrink-0 rounded-xl p-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-danger"
              onClick={() => {
                if (selections.length > 0) {
                  track('BET_NOT_FINISHED', { metadata: { selectionCount: selections.length } });
                }
                clear();
              }}
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        )}

        {tab === 'singles' && (
          <div className="space-y-3">
            {selections.map((selection) => (
              <SingleBetRow
                key={selectionKey(selection)}
                selection={selection}
                stake={getSingleStake(selection)}
                onStakeChange={(value) => setSingleStake(selection, value)}
                showStake={selections.length > 1}
                insuranceOptIn={insuranceOptIn}
                isFreebetMode={isFreebetMode}
              />
            ))}
          </div>
        )}

        {tab === 'accumulator' && (
          <div className="space-y-3">
            {selections.map((selection) => (
              <Card
                key={selectionKey(selection)}
                className="fade-in-up flex items-start justify-between gap-2 border-border bg-surface-2"
              >
                <div>
                  <p className="text-xs text-text-muted">{selection.matchLabel}</p>
                  <p className="text-sm font-medium">
                    {selection.marketName}: {selection.selectionName}
                  </p>
                  <MaxStakeNote selection={selection} />
                </div>
                <div className="flex items-center gap-2">
                  <SelectionOdds selection={selection} />
                  <button
                    type="button"
                    aria-label={`Remove ${selection.selectionName} for ${selection.matchLabel}`}
                    className="text-text-muted hover:text-danger"
                    onClick={() => removeSelection(selection.matchId, selection.marketId)}
                  >
                    ✕
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    );

    const isPending = tab === 'accumulator' ? placeAccumulatorMutation.isPending : placeSinglesMutation.isPending;
    const isValid = tab === 'accumulator' ? isStakeValid && !accumulatorInvalidReason : allSinglesValid;
    const activeMutation = tab === 'accumulator' ? placeAccumulatorMutation : placeSinglesMutation;
    const error = activeMutation.isError
      ? activeMutation.error instanceof Error
        ? activeMutation.error.message
        : 'Failed to place bet'
      : null;
    // Logging in wouldn't make this specific combination placeable - "Log in
    // to place a bet" would be a false promise here, so drop the second half.
    const isAccumulatorUncombinable = tab === 'accumulator' && Boolean(accumulatorInvalidReason);
    const loginCtaLabel = isAccumulatorUncombinable ? 'Log in' : 'Log in to place a bet';
    footer = (
      <div className="mt-3 shrink-0 space-y-2 border-t border-border pt-3">
        {tab === 'accumulator' && accumulatorInvalidReason && (
          <p className="rounded-xl border border-danger/40 bg-danger/10 px-2.5 py-2 text-xs font-medium text-danger">
            {accumulatorInvalidReason}
          </p>
        )}
        {tab === 'accumulator' && !isFreebetMode && !insuranceOptIn && !accumulatorInvalidReason && (
          <AccaBoostBar
            legOdds={selections.map((selection) => selection.odds)}
            config={accaBoostConfig}
            stakeCents={stakeCents}
          />
        )}
        {tab === 'accumulator' && !isFreebetMode && !insuranceOptIn && !accumulatorInvalidReason && (
          <AccaRollbackBar selectionCount={selections.length} config={accaRollbackConfig} />
        )}
        {tab === 'accumulator' && (
          <>
            <StakeField
              stakeId={stakeId}
              stake={stake}
              onStakeChange={setStake}
              odds={insuranceEffectiveCombinedOdds ?? combinedOdds}
              previousOdds={
                accaBoost.qualifies
                  ? accaBoost.baseCombinedOdds
                  : insuranceApplies
                    ? combinedOdds
                    : undefined
              }
              invalid={Boolean(accumulatorInvalidReason)}
            />
            <StakeLimitAlert stakeCents={stakeCents} preview={accumulatorStakeLimitPreview} />
            <CampaignQualificationNote preview={accumulatorCampaignPreview} />
          </>
        )}
        {singleSelection && (
          <>
            <StakeField
              stakeId={stakeId}
              stake={getSingleStake(singleSelection)}
              onStakeChange={(value) => setSingleStake(singleSelection, value)}
              odds={insuranceEffectiveSingleOdds ?? singleSelection.odds}
              hideOdds={!insuranceApplies}
              previousOdds={insuranceApplies ? singleSelection.odds : undefined}
            />
            <StakeLimitAlert
              stakeCents={Math.round(Number(getSingleStake(singleSelection)) * 100)}
              preview={singleSelectionStakeLimitPreview}
            />
            <CampaignQualificationNote preview={singleSelectionCampaignPreview} />
          </>
        )}
        {!isFreebetMode && insuranceBetConfig.enabled && selections.length > 0 && !insuranceIneligible && (
          <div className="rounded-xl border border-border bg-surface-2 p-2.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-display font-bold tracking-wide text-text-secondary uppercase italic">
                Insure this bet
              </span>
              <Switch checked={insuranceOptIn} onChange={setInsuranceOptIn} ariaLabel="Insure this bet" />
            </div>
            {/* grid-rows 0fr->1fr trick: only way to animate to/from an
                intrinsic ("auto") height with a plain CSS transition. */}
            <div
              className={cn(
                'grid transition-[grid-template-rows] duration-300 ease-out',
                insuranceOptIn ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
              )}
            >
              <div className="overflow-hidden">
                <p className="pt-1.5 text-text-secondary">
                  {isCurrentTabValid && currentTabRawPayoutCents > 0 ? (
                    <>
                      If it wins, you'd get {formatMoney(currentTabInsurancePreviewCents)} instead of{' '}
                      {formatMoney(currentTabRawPayoutCents)} ({insuranceBetConfig.costPercent}% less). If it
                      loses, your full stake is returned as a freebet.
                    </>
                  ) : (
                    <>
                      Pay {insuranceBetConfig.costPercent}% less in winnings to be protected - if this bet loses,
                      your full stake is returned as a freebet.
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between text-sm text-text-secondary">
          <span>Potential payout</span>
          {tab === 'accumulator' && accumulatorInvalidReason ? (
            <span className="font-semibold text-text-muted" aria-label="Payout not combinable">
              /
            </span>
          ) : insuranceApplies && isCurrentTabValid ? (
            <MoneyBeforeAfter beforeCents={currentTabRawPayoutCents} afterCents={currentTabInsurancePreviewCents} />
          ) : (
            <span className="font-semibold text-text-primary">
              {tab === 'accumulator' ? potentialPayout : totalSinglesPayout}
            </span>
          )}
        </div>
        {error && error !== 'Insufficient balance' && <p className="text-xs text-danger">{error}</p>}
        {isAuthenticated ? (
          <Button
            variant="primary"
            className="w-full"
            disabled={!isValid || isPending}
            onClick={() => {
              if (tab === 'accumulator') {
                placeAccumulatorMutation.mutate({
                  selections,
                  stakeCents,
                  useFreebets: isFreebetMode || undefined,
                  insuranceOptIn: isFreebetMode ? undefined : insuranceOptIn,
                });
              } else {
                placeSinglesMutation.mutate();
              }
            }}
          >
            {isPending ? 'Placing…' : 'Place Bet'}
          </Button>
        ) : (
          <button
            type="button"
            onClick={() => openAuthModal('login')}
            className="btn-primary block w-full text-center"
          >
            {loginCtaLabel}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {isAuthenticated && wallet && (
        <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
          <BalancePills
            cashCents={wallet.balanceCents}
            freebetsCents={sumFreebetsCents(freebets)}
            activeKind={hasFreebets && selections.length > 0 ? (isFreebetMode ? 'freebets' : 'cash') : undefined}
          />
          {hasFreebets && selections.length > 0 && (
            <div className="flex shrink-0 items-center gap-2">
              <span className={cn('text-xs font-semibold', !isFreebetMode ? 'text-text-primary' : 'text-text-muted')}>
                Cash
              </span>
              <Switch
                checked={isFreebetMode}
                onChange={(checked) => setPayMethod(checked ? 'freebet' : 'cash')}
                ariaLabel="Pay with freebets"
              />
              <span className={cn('text-xs font-semibold', isFreebetMode ? 'text-text-primary' : 'text-text-muted')}>
                Freebets
              </span>
            </div>
          )}
        </div>
      )}
      {showHistoryTab && (
        <div className="tab-pill mb-3 w-full shrink-0" role="tablist" aria-label="Bet slip panel view">
          <button
            type="button"
            role="tab"
            aria-selected={panelView === 'slip'}
            className={`tab-pill-btn${panelView === 'slip' ? ' active' : ''}`}
            onClick={() => setPanelView('slip')}
          >
            Bet Slip
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={panelView === 'history'}
            className={`tab-pill-btn${panelView === 'history' ? ' active' : ''}`}
            onClick={() => setPanelView('history')}
          >
            Bet History
          </button>
        </div>
      )}
      <div className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-y-auto">{mainContent}</div>
      {footer}
    </div>
  );
}
