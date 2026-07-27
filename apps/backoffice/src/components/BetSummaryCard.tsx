import type { ReactNode } from 'react';
import { Card } from './ui/Card';
import type { Bet, BetSelection } from '../lib/backendApi';

export function formatCents(cents: number): string {
  return `${(cents / 100).toFixed(2)} €`;
}

/**
 * combinedOdds/potentialPayoutCents already have any acca boost/insurance
 * baked in as of placement time (see PamService.placeBet) - the
 * pre-boost/pre-insurance values are re-derived here rather than stored
 * redundantly, matching PamService.settleSelection's own convention of
 * recomputing instead of trusting a stored derived value.
 */
export function unboostedCombinedOdds(bet: Bet): number {
  return Number(bet.combinedOdds) / (1 + bet.accaBoostPercent / 100);
}

export function displayedPayoutCents(bet: Bet): number {
  return bet.status === 'PENDING' ? bet.potentialPayoutCents : (bet.settledPayoutCents ?? 0);
}

export function uninsuredPayoutCents(bet: Bet): number {
  return Math.round(displayedPayoutCents(bet) / (1 - bet.insuranceCostPercent / 100));
}

export const statusBadgeClassName: Record<string, string> = {
  PENDING: 'bg-surface-hover text-text-secondary',
  OPEN: 'bg-surface-hover text-text-secondary',
  WON: 'bg-brand/20 text-brand',
  LOST: 'bg-danger/20 text-danger',
  VOID: 'bg-warning/20 text-warning',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusBadgeClassName[status] ?? ''}`}>
      {status}
    </span>
  );
}

function BetTag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
      {children}
    </span>
  );
}

interface BetSummaryCardProps {
  bet: Bet;
  /** Omit for a read-only view (shows each selection's current status badge instead). */
  renderSelectionActions?: (selection: BetSelection) => ReactNode;
}

/** Shared bet card layout - used by the settlement queue (with settle buttons) and the Bet History report (read-only). */
export function BetSummaryCard({ bet, renderSelectionActions }: BetSummaryCardProps) {
  const isAccumulator = bet.selections.length > 1;
  const payoutCents = displayedPayoutCents(bet);
  const showInsuranceBeforeAfter = bet.insuranceCostPercent > 0 && payoutCents > 0;
  const campaignName = bet.betAndGetCampaignName ?? bet.depositCampaignName;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
        <div>
          <p className="text-sm font-medium">
            {bet.user.username} <span className="text-text-muted">({bet.user.email})</span>
          </p>
          <p className="text-xs text-text-muted">
            Bet {bet.id} &middot;{' '}
            {new Date(bet.createdAt).toLocaleString(undefined, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <BetTag>{isAccumulator ? `Accumulator (${bet.selections.length})` : 'Single'}</BetTag>
            {bet.fundedByFreebets && <BetTag>Freebet</BetTag>}
            {bet.insuranceCostPercent > 0 && <BetTag>Insured</BetTag>}
            {bet.accaBoostPercent > 0 && <BetTag>Boosted +{bet.accaBoostPercent}%</BetTag>}
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-text-secondary">
            Stake {formatCents(bet.stakeCents)} @{' '}
            {isAccumulator && bet.accaBoostPercent > 0 ? (
              <>
                <span className="text-text-muted line-through">{unboostedCombinedOdds(bet).toFixed(2)}</span>{' '}
                &rarr; {Number(bet.combinedOdds).toFixed(2)}
              </>
            ) : (
              Number(bet.combinedOdds).toFixed(2)
            )}
          </span>
          <span className="text-text-secondary">
            Payout{' '}
            {showInsuranceBeforeAfter ? (
              <>
                <span className="text-text-muted line-through">{formatCents(uninsuredPayoutCents(bet))}</span>{' '}
                &rarr; {formatCents(payoutCents)}
              </>
            ) : bet.settledPayoutCents !== null ? (
              formatCents(bet.settledPayoutCents)
            ) : (
              formatCents(bet.potentialPayoutCents) + ' (potential)'
            )}
          </span>
          <StatusBadge status={bet.status} />
        </div>
      </div>

      {(campaignName || bet.accaRollbackRewardCents !== null) && (
        <div className="pt-2 text-xs text-highlight">
          {campaignName && <p>Qualified for {campaignName}</p>}
          {bet.accaRollbackRewardCents !== null && (
            <p>{formatCents(bet.accaRollbackRewardCents)} refunded as a freebet (Acca Rollback)</p>
          )}
        </div>
      )}

      <div className="mt-3 space-y-2">
        {bet.selections.map((selection) => (
          <div
            key={selection.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-background px-3 py-2"
          >
            <div>
              <p className="text-xs text-text-muted">{selection.matchLabel}</p>
              {selection.sport && (
                <p className="text-[10px] text-text-muted/70">
                  {selection.sport}
                  {selection.competition && ` · ${selection.competition}`}
                </p>
              )}
              <p className="text-sm">
                {selection.marketName}: {selection.selectionName}{' '}
                <span className="text-text-secondary">@ {Number(selection.odds).toFixed(2)}</span>
              </p>
            </div>
            {renderSelectionActions ? renderSelectionActions(selection) : <StatusBadge status={selection.status} />}
          </div>
        ))}
      </div>
    </Card>
  );
}
