import { useState, type ReactNode } from 'react';
import { Card } from '../../components/ui/Card';
import { ChevronIcon } from '../../components/ui/ChevronIcon';
import { EmptyState } from '../../components/ui/EmptyState';
import { MoneyBeforeAfter } from '../../components/ui/MoneyBeforeAfter';
import { ClockIcon } from '../../components/ui/NavIcons';
import { Skeleton } from '../../components/ui/Skeleton';
import { betStatusBadgeClasses, betStatusLabel, betStatusTextClasses } from '../../lib/betStatus';
import type { PlacedBet, PlacedBetSelection } from '../../lib/backendApi';
import { useAuth } from '../auth/useAuth';
import { useAuthModalStore } from '../auth/authModalStore';
import { sortBetsForHistory } from './sortBetsForHistory';
import { useBets } from './useBets';

export type BetHistoryFilter = 'OPEN' | 'WON' | 'FINISHED';

function formatEuros(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}

/**
 * combinedOdds/potentialPayoutCents already have any acca boost/insurance
 * baked in as of placement time (see PamService.placeBet) - the
 * pre-boost/pre-insurance values are re-derived here rather than stored
 * redundantly, same "recompute, don't trust a stored derived value"
 * convention PamService.settleSelection itself follows.
 */
function unboostedCombinedOdds(bet: PlacedBet): number {
  return Number(bet.combinedOdds) / (1 + bet.accaBoostPercent / 100);
}

function displayedPayoutCents(bet: PlacedBet): number {
  return bet.status === 'PENDING' ? bet.potentialPayoutCents : (bet.settledPayoutCents ?? 0);
}

function uninsuredPayoutCents(bet: PlacedBet): number {
  return Math.round(displayedPayoutCents(bet) / (1 - bet.insuranceCostPercent / 100));
}

function BetTag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
      {children}
    </span>
  );
}

/** Small filled circle per accumulator leg - a check/cross/dash glyph once a leg has settled, a clock while still OPEN. Collapsed-state summary so a player can see at a glance how an accumulator is going without expanding it. */
function SelectionStatusDot({ status }: { status: PlacedBetSelection['status'] }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold leading-none ${betStatusBadgeClasses(status)}`}
    >
      {status === 'WON' ? '✓' : status === 'LOST' ? '✕' : status === 'VOID' ? '–' : <ClockIcon width={11} height={11} />}
    </span>
  );
}

function SelectionRow({ selection }: { selection: PlacedBetSelection }) {
  return (
    <div className="text-sm">
      <p className="text-xs text-text-muted">{selection.matchLabel}</p>
      <p>
        <span className={betStatusTextClasses(selection.status)}>
          {selection.marketName}: {selection.selectionName}
        </span>{' '}
        <span className="text-text-secondary">@ {Number(selection.odds).toFixed(2)}</span>
      </p>
    </div>
  );
}

function BetCard({ bet }: { bet: PlacedBet }) {
  const isAccumulator = bet.selections.length > 1;
  const [isExpanded, setIsExpanded] = useState(false);
  const payoutCents = displayedPayoutCents(bet);
  const showInsuranceBeforeAfter = bet.insuranceCostPercent > 0 && payoutCents > 0;
  const campaignName = bet.betAndGetCampaignName ?? bet.depositCampaignName;

  return (
    <Card className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest ${betStatusBadgeClasses(bet.status)}`}
          >
            {betStatusLabel(bet.status)}
          </span>
          <BetTag>{isAccumulator ? `Accumulator (${bet.selections.length})` : 'Single'}</BetTag>
          {bet.fundedByFreebets && <BetTag>Freebet</BetTag>}
          {bet.insuranceCostPercent > 0 && <BetTag>Insured</BetTag>}
          {bet.accaBoostPercent > 0 && <BetTag>Boosted +{bet.accaBoostPercent}%</BetTag>}
        </div>
        <span className="text-xs text-text-muted">
          {new Date(bet.createdAt).toLocaleString(undefined, {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      {isAccumulator ? (
        <div>
          <button
            type="button"
            onClick={() => setIsExpanded((expanded) => !expanded)}
            aria-expanded={isExpanded}
            className="flex w-full items-center justify-between gap-2 rounded-lg py-1 text-left"
          >
            <span className="flex flex-wrap items-center gap-1">
              {bet.selections.map((selection) => (
                <SelectionStatusDot key={selection.id} status={selection.status} />
              ))}
            </span>
            <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-text-secondary">
              {isExpanded ? 'Hide selections' : 'Show selections'}
              <ChevronIcon width={14} height={14} className={isExpanded ? 'rotate-180' : ''} />
            </span>
          </button>
          {isExpanded && (
            <div className="space-y-1 border-t border-border pt-2">
              {bet.selections.map((selection) => (
                <SelectionRow key={selection.id} selection={selection} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          {bet.selections.map((selection) => (
            <SelectionRow key={selection.id} selection={selection} />
          ))}
        </div>
      )}

      {campaignName && <p className="text-xs text-highlight">Qualified for {campaignName}</p>}
      {bet.accaRollbackRewardCents !== null && (
        <p className="text-xs text-highlight">
          {formatEuros(bet.accaRollbackRewardCents)} refunded as a freebet (Acca Rollback)
        </p>
      )}

      <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
        <span className="text-text-secondary">
          Stake {formatEuros(bet.stakeCents)}
          {isAccumulator &&
            (bet.accaBoostPercent > 0 ? (
              <>
                {' '}
                · Combined odds {unboostedCombinedOdds(bet).toFixed(2)} &rarr; {Number(bet.combinedOdds).toFixed(2)}
              </>
            ) : (
              ` · Combined odds ${Number(bet.combinedOdds).toFixed(2)}`
            ))}
        </span>
        <span className="font-semibold">
          {showInsuranceBeforeAfter ? (
            <MoneyBeforeAfter beforeCents={uninsuredPayoutCents(bet)} afterCents={payoutCents} />
          ) : bet.status === 'PENDING' ? (
            `Potential ${formatEuros(payoutCents)}`
          ) : (
            `Payout ${formatEuros(payoutCents)}`
          )}
        </span>
      </div>
    </Card>
  );
}

function matchesFilter(bet: PlacedBet, filter: BetHistoryFilter): boolean {
  if (filter === 'OPEN') return bet.status === 'PENDING';
  if (filter === 'WON') return bet.status === 'WON';
  return bet.status !== 'PENDING';
}

interface BetHistoryListProps {
  /** Defaults to showing every bet - MyBetsPage passes the active Open/Won/Finished tab. */
  filter?: BetHistoryFilter;
}

export function BetHistoryList({ filter }: BetHistoryListProps) {
  const { isAuthenticated, isInitialized } = useAuth();
  const openAuthModal = useAuthModalStore((state) => state.open);
  const { data: bets, isPending, isError } = useBets();

  if (isInitialized && !isAuthenticated) {
    return (
      <EmptyState
        title="Log in to see your bets"
        description="Your bet history shows up here once you're signed in."
        ctaLabel="Log in"
        onCtaClick={() => openAuthModal('login')}
      />
    );
  }

  if (isPending) {
    return (
      <div className="space-y-3" aria-label="Loading bet history" role="status">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return <Card className="text-danger">Failed to load your bet history.</Card>;
  }

  if (!bets || bets.length === 0) {
    return (
      <EmptyState
        title="No bets placed yet"
        description="Pick an odd on any match to place your first bet."
        ctaLabel="Browse matches"
        ctaHref="/"
      />
    );
  }

  const filtered = filter ? bets.filter((bet) => matchesFilter(bet, filter)) : bets;
  const sorted = sortBetsForHistory(filtered);

  if (sorted.length === 0) {
    return (
      <EmptyState
        title={filter === 'OPEN' ? 'No open bets' : filter === 'WON' ? 'No won bets yet' : 'No finished bets yet'}
        description="Bets matching this filter will show up here."
      />
    );
  }

  return (
    <div className="space-y-3">
      {sorted.map((bet) => (
        <BetCard key={bet.id} bet={bet} />
      ))}
    </div>
  );
}
