import { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { ChevronIcon } from '../../components/ui/ChevronIcon';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import type { PlacedBet } from '../../lib/backendApi';
import { useAuth } from '../auth/useAuth';
import { useAuthModalStore } from '../auth/authModalStore';
import {
  BetBadgesRow,
  BetCampaignNotes,
  BetFooterSummary,
  SelectionRow,
  SelectionStatusDot,
} from './betCardShared';
import { useBetDetailModalStore } from './betDetailModalStore';
import { sortBetsForHistory } from './sortBetsForHistory';
import { useBets } from './useBets';

export type BetHistoryFilter = 'OPEN' | 'WON' | 'FINISHED';

function BetCard({ bet }: { bet: PlacedBet }) {
  const isAccumulator = bet.selections.length > 1;
  const [isExpanded, setIsExpanded] = useState(false);
  const openDetail = useBetDetailModalStore((state) => state.open);

  return (
    <Card className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BetBadgesRow bet={bet} />
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

      <BetCampaignNotes bet={bet} />
      <BetFooterSummary bet={bet} />

      <button
        type="button"
        onClick={() => openDetail(bet.id)}
        className="w-full text-center text-xs font-semibold text-text-secondary hover:text-text-primary"
      >
        View details
      </button>
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
