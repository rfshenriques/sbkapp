import { useEffect, useId, useRef, useState, type ReactNode, type SVGProps } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { cn } from '../../lib/cn';
import { placeBet } from '../../lib/backendApi';
import { useAuth } from '../auth/useAuth';
import { walletQueryKey } from '../wallet/useWallet';
import { betsQueryKey } from '../bet-history/useBets';
import { BetHistoryList } from '../bet-history/BetHistoryList';
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

interface StakeCalculatorProps {
  stakeId: string;
  stake: string;
  onStakeChange: (value: string) => void;
  odds: number;
  oddsLabel?: string;
  potentialPayout: string;
  isAuthenticated: boolean;
  isPending: boolean;
  isStakeValid: boolean;
  onPlaceBet: () => void;
  error?: string | null;
}

/**
 * Stake input paired with the relevant odds (a single selection's own odds,
 * or the accumulator's combined odds) side by side, then potential payout,
 * then the CTA - reused by both SingleBetRow and the accumulator's fixed
 * footer so the two read as the same calculator. Logged out swaps the
 * disabled "Place Bet" button for a real, clickable "Log in" button rather
 * than a dead control, and skips the stake/payout inputs entirely since
 * there's nothing to calculate yet.
 */
function StakeCalculator({
  stakeId,
  stake,
  onStakeChange,
  odds,
  oddsLabel = 'Odds',
  potentialPayout,
  isAuthenticated,
  isPending,
  isStakeValid,
  onPlaceBet,
  error,
}: StakeCalculatorProps) {
  return (
    <div className="space-y-2">
      {isAuthenticated && (
        <>
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
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <span className="odd-btn shrink-0">
              <span className="odd-label">{oddsLabel}</span>
              <span className="odd-value">{odds.toFixed(2)}</span>
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span>Potential payout</span>
            <span className="font-semibold text-text-primary">{potentialPayout}</span>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
        </>
      )}
      {isAuthenticated ? (
        <Button variant="primary" className="w-full" disabled={!isStakeValid || isPending} onClick={onPlaceBet}>
          {isPending ? 'Placing…' : 'Place Bet'}
        </Button>
      ) : (
        <Link to="/login" className="btn-primary block w-full text-center">
          Log in to place a bet
        </Link>
      )}
    </div>
  );
}

interface SingleBetRowProps {
  selection: BetSlipSelection;
  isAuthenticated: boolean;
  /**
   * Confirmation is owned by the parent, not local state - onSuccess also
   * removes this selection (unmounting this row) in the same update, so any
   * local "placed!" state here would never get a chance to render.
   */
  onPlaced: (message: string) => void;
}

/** Its own useMutation/stake state, so placing one single doesn't disable or affect any other row. */
function SingleBetRow({ selection, isAuthenticated, onPlaced }: SingleBetRowProps) {
  const removeSelection = useBetSlipStore((state) => state.removeSelection);
  const queryClient = useQueryClient();
  const [stake, setStake] = useState('10.00');
  const stakeId = useId();

  const placeBetMutation = useMutation({
    mutationFn: placeBet,
    onSuccess: (bet) => {
      onPlaced(
        `Bet placed! Stake ${(bet.stakeCents / 100).toFixed(2)}, potential payout ${(bet.potentialPayoutCents / 100).toFixed(2)}.`,
      );
      removeSelection(selection.matchId, selection.marketId);
      void queryClient.invalidateQueries({ queryKey: walletQueryKey });
      void queryClient.invalidateQueries({ queryKey: betsQueryKey });
    },
  });

  const stakeCents = Math.round(Number(stake) * 100);
  const isStakeValid = Number.isFinite(stakeCents) && stakeCents > 0;
  const potentialPayout = isStakeValid ? ((stakeCents * selection.odds) / 100).toFixed(2) : '—';

  return (
    <Card className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-text-muted">{selection.matchLabel}</p>
          <p className="text-sm font-medium">
            {selection.marketName}: {selection.selectionName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">{selection.odds.toFixed(2)}</span>
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

      <StakeCalculator
        stakeId={stakeId}
        stake={stake}
        onStakeChange={setStake}
        odds={selection.odds}
        oddsLabel="Odds"
        potentialPayout={potentialPayout}
        isAuthenticated={isAuthenticated}
        isPending={placeBetMutation.isPending}
        isStakeValid={isStakeValid}
        onPlaceBet={() => placeBetMutation.mutate({ selections: [selection], stakeCents })}
        error={
          placeBetMutation.isError
            ? placeBetMutation.error instanceof Error
              ? placeBetMutation.error.message
              : 'Failed to place bet'
            : null
        }
      />
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
  const queryClient = useQueryClient();
  const [stake, setStake] = useState('10.00');
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

  const placeBetMutation = useMutation({
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

  const showTabs = selections.length >= 2;
  const tab: BetSlipTab = showTabs ? activeTab : 'singles';
  const combinedOdds = selections.reduce((total, selection) => total * selection.odds, 1);
  const stakeCents = Math.round(Number(stake) * 100);
  const isStakeValid = Number.isFinite(stakeCents) && stakeCents > 0;
  const potentialPayout = isStakeValid ? ((stakeCents * combinedOdds) / 100).toFixed(2) : '—';

  function handlePlaceAccumulator() {
    setConfirmation(null);
    placeBetMutation.mutate({ selections, stakeCents });
  }

  // The accumulator's stake/payout/CTA is pulled out into its own `footer`
  // (rendered outside the scrollable region, see the return below) so it
  // stays visible while a long selection list scrolls underneath it -
  // singles don't need this since each row is already a self-contained
  // calculator right where it sits.
  let mainContent: ReactNode;
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
              className="mb-2 shrink-0 rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-danger"
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
                key={`${selection.matchId}-${selection.marketId}`}
                selection={selection}
                isAuthenticated={isAuthenticated}
                onPlaced={setConfirmation}
              />
            ))}
          </div>
        )}

        {tab === 'accumulator' && (
          <div className="space-y-3">
            {selections.map((selection) => (
              <Card
                key={`${selection.matchId}-${selection.marketId}`}
                className="flex items-start justify-between gap-2"
              >
                <div>
                  <p className="text-xs text-text-muted">{selection.matchLabel}</p>
                  <p className="text-sm font-medium">
                    {selection.marketName}: {selection.selectionName}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{selection.odds.toFixed(2)}</span>
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

    if (tab === 'accumulator') {
      footer = (
        <div className="mt-3 shrink-0 space-y-2 border-t border-border pt-3">
          <div className="flex items-center justify-between text-sm text-text-secondary">
            <span>Combined odds</span>
            <span className="font-semibold text-text-primary">{combinedOdds.toFixed(2)}</span>
          </div>
          <StakeCalculator
            stakeId={stakeId}
            stake={stake}
            onStakeChange={setStake}
            odds={combinedOdds}
            oddsLabel="Total"
            potentialPayout={potentialPayout}
            isAuthenticated={isAuthenticated}
            isPending={placeBetMutation.isPending}
            isStakeValid={isStakeValid}
            onPlaceBet={handlePlaceAccumulator}
            error={
              placeBetMutation.isError
                ? placeBetMutation.error instanceof Error
                  ? placeBetMutation.error.message
                  : 'Failed to place bet'
                : null
            }
          />
        </div>
      );
    }
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
