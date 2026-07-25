import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BetSummaryCard, statusBadgeClassName } from '../components/BetSummaryCard';
import { Skeleton } from '../components/ui/Skeleton';
import * as backendApi from '../lib/backendApi';
import type { BetStatus, SelectionStatus } from '../lib/backendApi';

const STATUS_FILTERS: Array<BetStatus | 'ALL'> = ['PENDING', 'WON', 'LOST', 'VOID', 'ALL'];
const SELECTION_STATUSES: SelectionStatus[] = ['OPEN', 'WON', 'LOST', 'VOID'];

const betsQueryKey = (status: BetStatus | 'ALL') => ['admin-bets', status] as const;

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
        {isPending && (
          <div className="space-y-2" aria-label="Loading bets" role="status">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        )}
        {isError && <p className="text-sm text-danger">Failed to load bets.</p>}
        {bets && bets.length === 0 && (
          <p className="text-sm text-text-secondary">No {statusFilter.toLowerCase()} bets.</p>
        )}

        {bets?.map((bet) => (
          <BetSummaryCard
            key={bet.id}
            bet={bet}
            renderSelectionActions={(selection) => (
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
            )}
          />
        ))}

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
