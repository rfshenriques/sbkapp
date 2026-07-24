import { useEffect, useId, useRef, useState, type ReactNode, type SVGProps } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { cn } from '../../lib/cn';
import { placeBet } from '../../lib/backendApi';
import { useAuth } from '../auth/useAuth';
import { useAuthModalStore } from '../auth/authModalStore';
import { walletQueryKey } from '../wallet/useWallet';
import { betsQueryKey } from '../bet-history/useBets';
import { BetHistoryList } from '../bet-history/BetHistoryList';
import { calculateAccaBoost, type AccaBoostConfig } from './accaBoost';
import { useAccaBoostConfig } from './useAccaBoostConfig';
import { useBetSlipStore, type BetSlipSelection } from './betSlipStore';

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

function selectionKey(selection: BetSlipSelection): string {
  return `${selection.matchId}-${selection.marketId}`;
}

/** Plain odds, or - when originalOdds is set (see BoostService.applyBoosts) - a Boost tag plus the struck-through original next to the boosted price. */
function SelectionOdds({ selection }: { selection: BetSlipSelection }) {
  if (selection.originalOdds === undefined) {
    return <span className="font-semibold">{selection.odds.toFixed(2)}</span>;
  }
  return (
    <span className="flex items-center gap-1.5">
      <span className="rounded-full bg-highlight px-1.5 py-px text-[9px] font-extrabold tracking-wide text-black uppercase">
        Boost
      </span>
      <span className="prev-odds text-xs font-semibold line-through decoration-1">
        {selection.originalOdds.toFixed(2)}
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
  if (selection.maxStakeCents === undefined) {
    return null;
  }
  const label = selection.originalOdds !== undefined ? 'Max stake for boosted price' : 'Max stake';
  return (
    <p className="text-[11px] text-text-secondary">
      {label}: €{(selection.maxStakeCents / 100).toFixed(2)}
    </p>
  );
}

/**
 * Only rendered for the accumulator tab - singles never qualify (see
 * calculateAccaBoost's minSelections gate). Three states: not enough
 * selections yet (progress bar toward the threshold), enough selections but
 * a leg's price is too short to qualify, or qualifying (bar full, shows the
 * live boost % and what one more selection would add).
 */
function AccaBoostBar({ legOdds, config }: { legOdds: number[]; config: AccaBoostConfig }) {
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
}

/**
 * Just the stake input, optionally paired with its odds - always visible
 * and editable regardless of login state, so a player can see what they'd
 * win before ever signing in. Potential payout is deliberately not part of
 * this component: the accumulator shows one payout for its one stake, but
 * singles share a single payout total in the footer instead of repeating a
 * payout line under every row - see the two `footer` branches below.
 */
function StakeField({ stakeId, stake, onStakeChange, odds, hideOdds, previousOdds }: StakeFieldProps) {
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
        <span className="odd-btn shrink-0">
          <span className="odd-label">Odds</span>
          {previousOdds !== undefined ? (
            <span className="flex items-center gap-1.5">
              <span className="text-xs text-text-secondary line-through decoration-1">
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
}

/**
 * Purely presentational now - its stake lives in the parent (see
 * `singleStakes` on BetSlipPanel) because placing "all singles together"
 * needs every row's stake at once. No place-bet button of its own: there's
 * exactly one, fixed at the bottom of the panel, regardless of how many
 * rows there are.
 */
function SingleBetRow({ selection, stake, onStakeChange, showStake }: SingleBetRowProps) {
  const removeSelection = useBetSlipStore((state) => state.removeSelection);
  const stakeId = useId();

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
        <StakeField
          stakeId={stakeId}
          stake={stake}
          onStakeChange={onStakeChange}
          odds={selection.odds}
          hideOdds
        />
      )}
    </Card>
  );
}

function CompactEmptyState({ confirmation }: { confirmation: string | null }) {
  return (
    <div className="space-y-3">
      {confirmation && <p className="text-sm text-brand">{confirmation}</p>}
      <p className="text-sm text-text-secondary">Your bet slip is empty.</p>
    </div>
  );
}

/** Desktop's persistent panel is never "just gone" - fills the available height and nudges toward browsing instead of sitting blank. */
function PromotionalEmptyState({ confirmation }: { confirmation: string | null }) {
  return (
    <EmptyState
      above={confirmation && <p className="text-sm text-brand">{confirmation}</p>}
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
  const queryClient = useQueryClient();
  const [stake, setStake] = useState('10.00');
  // Keyed by selectionKey() - each single-bet row's own stake, entered
  // independently of every other row but all placed together by the one
  // bottom button (see placeSinglesMutation below).
  const [singleStakes, setSingleStakes] = useState<Record<string, string>>({});
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [panelView, setPanelView] = useState<PanelView>('slip');
  // Fresh per mount (the mobile drawer remounts this on every open), so a
  // slip with 2+ selections always opens straight to Accumulator, and the
  // user can still switch tabs manually afterward.
  const [activeTab, setActiveTab] = useState<BetSlipTab>(() =>
    selections.length >= 2 ? 'accumulator' : 'singles',
  );
  // Desktop mounts this once and keeps it mounted (no per-open remount like
  // the mobile drawer), so the initializer above only fires once - jump to
  // Accumulator specifically on the 1->2+ transition instead, without
  // fighting a manual switch back to Singles once already at 2+.
  const hadMultipleSelectionsRef = useRef(selections.length >= 2);
  useEffect(() => {
    const hasMultipleNow = selections.length >= 2;
    if (hasMultipleNow && !hadMultipleSelectionsRef.current) {
      setActiveTab('accumulator');
    }
    hadMultipleSelectionsRef.current = hasMultipleNow;
  }, [selections.length]);
  const stakeId = useId();

  function getSingleStake(selection: BetSlipSelection): string {
    return singleStakes[selectionKey(selection)] ?? '10.00';
  }
  function setSingleStake(selection: BetSlipSelection, value: string) {
    setSingleStakes((previous) => ({ ...previous, [selectionKey(selection)]: value }));
  }

  const placeAccumulatorMutation = useMutation({
    mutationFn: placeBet,
    onSuccess: (bet) => {
      clear();
      setConfirmation(
        `Bet placed! Stake ${(bet.stakeCents / 100).toFixed(2)}, potential payout ${(bet.potentialPayoutCents / 100).toFixed(2)}.`,
      );
      void queryClient.invalidateQueries({ queryKey: walletQueryKey });
      void queryClient.invalidateQueries({ queryKey: betsQueryKey });
    },
  });

  /** Places every single-bet row's own stake as its own separate bet, all at once from the one bottom button. */
  const placeSinglesMutation = useMutation({
    mutationFn: async () => {
      return Promise.all(
        selections.map((selection) => {
          const stakeCents = Math.round(Number(getSingleStake(selection)) * 100);
          return placeBet({ selections: [selection], stakeCents });
        }),
      );
    },
    onSuccess: (bets) => {
      clear();
      const totalStakeCents = bets.reduce((total, bet) => total + bet.stakeCents, 0);
      const totalPayoutCents = bets.reduce((total, bet) => total + bet.potentialPayoutCents, 0);
      setConfirmation(
        `Bet placed! Stake ${(totalStakeCents / 100).toFixed(2)}, potential payout ${(totalPayoutCents / 100).toFixed(2)}.`,
      );
      void queryClient.invalidateQueries({ queryKey: walletQueryKey });
      void queryClient.invalidateQueries({ queryKey: betsQueryKey });
    },
  });

  const showTabs = selections.length >= 2;
  const tab: BetSlipTab = showTabs ? activeTab : 'singles';
  const accaBoost = calculateAccaBoost(
    selections.map((selection) => selection.odds),
    accaBoostConfig,
  );
  // The un-boosted product passes straight through when the accumulator doesn't qualify (see calculateAccaBoost).
  const combinedOdds = accaBoost.boostedCombinedOdds;
  const stakeCents = Math.round(Number(stake) * 100);
  const isStakeValid = Number.isFinite(stakeCents) && stakeCents > 0;
  const potentialPayout = isStakeValid ? ((stakeCents * combinedOdds) / 100).toFixed(2) : '—';
  const allSinglesValid =
    selections.length > 0 &&
    selections.every((selection) => {
      const cents = Math.round(Number(getSingleStake(selection)) * 100);
      return Number.isFinite(cents) && cents > 0;
    });
  // One payout total for all singles together, shown once in the footer -
  // each row already shows its own stake and odds, so repeating a payout
  // line under every row as well would just be more noise.
  const totalSinglesPayout = allSinglesValid
    ? (
        selections.reduce((total, selection) => {
          const stakeCents = Math.round(Number(getSingleStake(selection)) * 100);
          return total + stakeCents * selection.odds;
        }, 0) / 100
      ).toFixed(2)
    : '—';

  let mainContent: ReactNode;
  // Stake/payout/CTA lives outside the scrollable region (see the `footer`
  // return below) so it stays visible while a long selection list scrolls
  // underneath it - exactly one CTA regardless of tab or selection count.
  let footer: ReactNode = null;

  if (panelView === 'history') {
    mainContent = <BetHistoryList />;
  } else if (selections.length === 0) {
    mainContent =
      emptyStateVariant === 'promotional' ? (
        <PromotionalEmptyState confirmation={confirmation} />
      ) : (
        <CompactEmptyState confirmation={confirmation} />
      );
  } else {
    mainContent = (
      <div className="space-y-3">
        {confirmation && <p className="text-sm text-brand">{confirmation}</p>}
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
              onClick={clear}
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
    const isValid = tab === 'accumulator' ? isStakeValid : allSinglesValid;
    const activeMutation = tab === 'accumulator' ? placeAccumulatorMutation : placeSinglesMutation;
    const error = activeMutation.isError
      ? activeMutation.error instanceof Error
        ? activeMutation.error.message
        : 'Failed to place bet'
      : null;
    // A lone selection has nowhere else for its stake to live once it's not
    // inline on the row (see SingleBetRow's showStake) - one selection means
    // tab is always 'singles' already, so this and the accumulator's own
    // stake field below are mutually exclusive.
    const singleSelection = selections.length === 1 ? selections[0] : undefined;

    footer = (
      <div className="mt-3 shrink-0 space-y-2 border-t border-border pt-3">
        {tab === 'accumulator' && (
          <AccaBoostBar legOdds={selections.map((selection) => selection.odds)} config={accaBoostConfig} />
        )}
        {tab === 'accumulator' && (
          <StakeField
            stakeId={stakeId}
            stake={stake}
            onStakeChange={setStake}
            odds={combinedOdds}
            previousOdds={accaBoost.qualifies ? accaBoost.baseCombinedOdds : undefined}
          />
        )}
        {singleSelection && (
          <StakeField
            stakeId={stakeId}
            stake={getSingleStake(singleSelection)}
            onStakeChange={(value) => setSingleStake(singleSelection, value)}
            odds={singleSelection.odds}
            hideOdds
          />
        )}
        <div className="flex items-center justify-between text-sm text-text-secondary">
          <span>Potential payout</span>
          <span className="font-semibold text-text-primary">
            {tab === 'accumulator' ? potentialPayout : totalSinglesPayout}
          </span>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        {isAuthenticated ? (
          <Button
            variant="primary"
            className="w-full"
            disabled={!isValid || isPending}
            onClick={() => {
              setConfirmation(null);
              if (tab === 'accumulator') {
                placeAccumulatorMutation.mutate({ selections, stakeCents });
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
            Log in to place a bet
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
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
