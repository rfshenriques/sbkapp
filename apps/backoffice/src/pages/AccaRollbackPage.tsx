import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { toast, errorMessage } from '../features/toast/toastStore';
import * as backendApi from '../lib/backendApi';

const accaRollbackQueryKey = ['acca-rollback-config'] as const;

export default function AccaRollbackPage() {
  const queryClient = useQueryClient();
  const {
    data,
    isPending,
    isError,
  } = useQuery({ queryKey: accaRollbackQueryKey, queryFn: backendApi.getAccaRollbackConfig });

  const [draft, setDraft] = useState<backendApi.AccaRollbackConfig | null>(null);

  useEffect(() => {
    if (data && draft === null) {
      setDraft(data);
    }
  }, [data, draft]);

  const saveMutation = useMutation({
    mutationFn: (config: backendApi.AccaRollbackConfig) => backendApi.setAccaRollbackConfig(config),
    onSuccess: (saved) => {
      setDraft(saved);
      void queryClient.invalidateQueries({ queryKey: accaRollbackQueryKey });
      toast.success('Acca rollback settings saved');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to save acca rollback settings')),
  });

  const isValid =
    draft !== null &&
    Number.isInteger(draft.minSelections) &&
    draft.minSelections >= 2 &&
    Number.isInteger(draft.lossThreshold) &&
    draft.lossThreshold >= 1 &&
    Number.isFinite(draft.rewardPercent) &&
    draft.rewardPercent >= 0 &&
    draft.rewardPercent <= 100;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Acca rollback</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Refunds a qualifying accumulator's stake as a freebet when it loses by no more than the loss
        threshold below - a 4-selection acca that loses by exactly one leg still gets money back.
        Applies only once every leg is settled, and never on a bet already funded by a freebet.
      </p>

      <div className="mt-4 max-w-md">
        {isPending && (
          <div className="space-y-2" aria-label="Loading acca rollback config" role="status">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        )}
        {isError && <p className="text-sm text-danger">Failed to load acca rollback config.</p>}

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
              <label htmlFor="min-selections" className="block text-xs text-text-secondary">
                Min selections
              </label>
              <input
                id="min-selections"
                type="text"
                inputMode="numeric"
                value={draft.minSelections}
                onChange={(event) => setDraft({ ...draft, minSelections: Number(event.target.value) })}
                className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text-primary"
              />
            </div>

            <div>
              <label htmlFor="loss-threshold" className="block text-xs text-text-secondary">
                Loss threshold (legs)
              </label>
              <input
                id="loss-threshold"
                type="text"
                inputMode="numeric"
                value={draft.lossThreshold}
                onChange={(event) => setDraft({ ...draft, lossThreshold: Number(event.target.value) })}
                className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text-primary"
              />
            </div>

            <div>
              <label htmlFor="reward-percent" className="block text-xs text-text-secondary">
                Reward %
              </label>
              <input
                id="reward-percent"
                type="text"
                inputMode="decimal"
                value={draft.rewardPercent}
                onChange={(event) => setDraft({ ...draft, rewardPercent: Number(event.target.value) })}
                className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text-primary"
              />
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
