import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '../components/ui/Card';
import * as backendApi from '../lib/backendApi';
import type { BetStatus, SelectionStatus } from '../lib/backendApi';

const STATUS_FILTERS: Array<BetStatus | 'ALL'> = ['PENDING', 'WON', 'LOST', 'VOID', 'ALL'];
const SELECTION_STATUSES: SelectionStatus[] = ['OPEN', 'WON', 'LOST', 'VOID'];

const betsQueryKey = (status: BetStatus | 'ALL') => ['admin-bets', status] as const;

function formatCents(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}

/**
 * combinedOdds/potentialPayoutCents already have any acca boost/insurance
 * baked in as of placement time (see PamService.placeBet) - the
 * pre-boost/pre-insurance values are re-derived here rather than stored
 * redundantly, matching PamService.settleSelection's own convention of
 * recomputing instead of trusting a stored derived value.
 */
function unboostedCombinedOdds(bet: backendApi.Bet): number {
  return Number(bet.combinedOdds) / (1 + bet.accaBoostPercent / 100);
}

function displayedPayoutCents(bet: backendApi.Bet): number {
  return bet.status === 'PENDING' ? bet.potentialPayoutCents : (bet.settledPayoutCents ?? 0);
}

function uninsuredPayoutCents(bet: backendApi.Bet): number {
  return Math.round(displayedPayoutCents(bet) / (1 - bet.insuranceCostPercent / 100));
}

function BetTag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
      {children}
    </span>
  );
}

const statusBadgeClassName: Record<string, string> = {
  PENDING: 'bg-surface-hover text-text-secondary',
  OPEN: 'bg-surface-hover text-text-secondary',
  WON: 'bg-brand/20 text-brand',
  LOST: 'bg-danger/20 text-danger',
  VOID: 'bg-warning/20 text-warning',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-medium ${statusBadgeClassName[status] ?? ''}`}
    >
      {status}
    </span>
  );
}

export default function SettlementPage() {
  const [statusFilter, setStatusFilter] = useState<BetStatus | 'ALL'>('PENDING');
  const queryClient = useQueryClient();

  const {
    data: bets,
    isPending,
    isError,
  } = useQuery({
    queryKey: betsQueryKey(statusFilter),
    queryFn: () => backendApi.listBets(statusFilter === 'ALL' ? undefined : statusFilter),
  });

  const settleMutation = useMutation({
    mutationFn: ({
      betId,
      selectionId,
      status,
    }: {
      betId: string;
      selectionId: string;
      status: SelectionStatus;
    }) => backendApi.settleSelection(betId, selectionId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-bets'] });
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Bet settlement</h1>

      <div className="mt-4 flex gap-2">
        {STATUS_FILTERS.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              statusFilter === status
                ? 'bg-brand text-slate-950'
                : 'bg-surface text-text-secondary hover:bg-surface-hover'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-4">
        {isPending && <p className="text-sm text-text-secondary">Loading bets…</p>}
        {isError && <p className="text-sm text-danger">Failed to load bets.</p>}
        {bets && bets.length === 0 && (
          <p className="text-sm text-text-secondary">No {statusFilter.toLowerCase()} bets.</p>
        )}

        {bets?.map((bet) => {
          const isAccumulator = bet.selections.length > 1;
          const payoutCents = displayedPayoutCents(bet);
          const showInsuranceBeforeAfter = bet.insuranceCostPercent > 0 && payoutCents > 0;
          const campaignName = bet.betAndGetCampaignName ?? bet.depositCampaignName;

          return (
          <Card key={bet.id}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
              <div>
                <p className="text-sm font-medium">
                  {bet.user.username} <span className="text-text-muted">({bet.user.email})</span>
                </p>
                <p className="text-xs text-text-muted">Bet {bet.id}</p>
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
                    <p className="text-sm">
                      {selection.marketName}: {selection.selectionName}{' '}
                      <span className="text-text-secondary">
                        @ {Number(selection.odds).toFixed(2)}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {SELECTION_STATUSES.map((candidateStatus) => (
                      <button
                        key={candidateStatus}
                        type="button"
                        disabled={settleMutation.isPending}
                        onClick={() =>
                          settleMutation.mutate({
                            betId: bet.id,
                            selectionId: selection.id,
                            status: candidateStatus,
                          })
                        }
                        className={`rounded px-2 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
                          selection.status === candidateStatus
                            ? (statusBadgeClassName[candidateStatus] ?? '')
                            : 'text-text-muted hover:text-text-primary'
                        }`}
                      >
                        {candidateStatus}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
          );
        })}

        {settleMutation.isError && (
          <p className="text-sm text-danger">
            {settleMutation.error instanceof Error
              ? settleMutation.error.message
              : 'Failed to settle selection.'}
          </p>
        )}
      </div>
    </div>
  );
}
