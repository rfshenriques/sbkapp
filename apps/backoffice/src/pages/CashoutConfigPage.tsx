import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { toast, errorMessage } from '../features/toast/toastStore';
import * as backendApi from '../lib/backendApi';

const cashoutConfigQueryKey = ['cashout-config'] as const;

export default function CashoutConfigPage() {
  const queryClient = useQueryClient();
  const {
    data,
    isPending,
    isError,
  } = useQuery({ queryKey: cashoutConfigQueryKey, queryFn: backendApi.getCashoutConfig });

  const [draft, setDraft] = useState<backendApi.CashoutConfig | null>(null);

  useEffect(() => {
    if (data && draft === null) {
      setDraft(data);
    }
  }, [data, draft]);

  const saveMutation = useMutation({
    mutationFn: (config: backendApi.CashoutConfig) => backendApi.setCashoutConfig(config),
    onSuccess: (saved) => {
      setDraft(saved);
      void queryClient.invalidateQueries({ queryKey: cashoutConfigQueryKey });
      toast.success('Cashout settings saved');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to save cashout settings')),
  });

  const isValid = draft !== null && Number.isFinite(draft.marginPercent) && draft.marginPercent >= 0 && draft.marginPercent <= 100;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Cashout</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Lets a player close a still-open bet early for a live-priced value: stake x (odds at placement / current
        odds) x (1 - margin %), computed off every selection's own live price for an accumulator. Cashing out a
        bet cancels any linked campaign qualification - no prize is ever triggered for it.
      </p>

      <div className="mt-4 max-w-md">
        {isPending && (
          <div className="space-y-2" aria-label="Loading cashout config" role="status">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        )}
        {isError && <p className="text-sm text-danger">Failed to load cashout config.</p>}

        {draft && (
          <Card className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
              />
              Enabled
            </label>

            <div>
              <label htmlFor="margin-percent" className="block text-xs text-text-secondary">
                Margin %
              </label>
              <input
                id="margin-percent"
                type="text"
                inputMode="decimal"
                value={draft.marginPercent}
                onChange={(event) => setDraft({ ...draft, marginPercent: Number(event.target.value) })}
                className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text-primary"
              />
              <p className="mt-1 text-xs text-text-secondary">
                The operator's own cut, deducted even when the odds haven't moved at all - a bet cashed out at
                unchanged odds is always credited stake x (1 - margin %), never the full stake back.
              </p>
            </div>

            <Button
              variant="primary"
              disabled={!isValid || saveMutation.isPending}
              onClick={() => draft && saveMutation.mutate(draft)}
            >
              Save
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
