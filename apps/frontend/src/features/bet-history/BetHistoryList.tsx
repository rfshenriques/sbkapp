import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import type { BetStatus, PlacedBet } from '../../lib/backendApi';
import { useAuth } from '../auth/useAuth';
import { sortBetsForHistory } from './sortBetsForHistory';
import { useBets } from './useBets';

const STATUS_STYLES: Record<BetStatus, string> = {
  PENDING: 'bg-highlight text-black',
  WON: 'bg-price-up text-black',
  LOST: 'bg-price-down text-white',
  VOID: 'bg-surface-2 text-text-secondary',
};

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

function BetCard({ bet }: { bet: PlacedBet }) {
  const isAccumulator = bet.selections.length > 1;
  return (
    <Card className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest ${STATUS_STYLES[bet.status]}`}>
          {bet.status}
        </span>
        <span className="text-xs text-text-muted">
          {new Date(bet.createdAt).toLocaleString(undefined, {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      <div className="space-y-1">
        {bet.selections.map((selection) => (
          <div key={selection.id} className="text-sm">
            <p className="text-xs text-text-muted">{selection.matchLabel}</p>
            <p>
              {selection.marketName}: {selection.selectionName}{' '}
              <span className="text-text-secondary">@ {Number(selection.odds).toFixed(2)}</span>
            </p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
        <span className="text-text-secondary">
          Stake {formatCents(bet.stakeCents)} {isAccumulator && `· Combined odds ${Number(bet.combinedOdds).toFixed(2)}`}
        </span>
        <span className="font-semibold">
          {bet.status === 'PENDING'
            ? `Potential ${formatCents(bet.potentialPayoutCents)}`
            : `Payout ${formatCents(bet.settledPayoutCents ?? 0)}`}
        </span>
      </div>
    </Card>
  );
}

export function BetHistoryList() {
  const { isAuthenticated, isInitialized } = useAuth();
  const { data: bets, isPending, isError } = useBets();

  if (isInitialized && !isAuthenticated) {
    return (
      <p className="text-sm text-text-secondary">
        <Link to="/login" className="text-text-primary hover:underline">
          Log in
        </Link>{' '}
        to see your bet history.
      </p>
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
    return <Card className="text-text-secondary">You haven't placed any bets yet.</Card>;
  }

  const sorted = sortBetsForHistory(bets);

  return (
    <div className="space-y-3">
      {sorted.map((bet) => (
        <BetCard key={bet.id} bet={bet} />
      ))}
    </div>
  );
}
