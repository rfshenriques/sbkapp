import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { toast, errorMessage } from '../features/toast/toastStore';
import * as backendApi from '../lib/backendApi';

const insuranceBetQueryKey = ['insurance-bet-config'] as const;

export default function InsuranceBetPage() {
  const queryClient = useQueryClient();
  const {
    data,
    isPending,
    isError,
  } = useQuery({ queryKey: insuranceBetQueryKey, queryFn: backendApi.getInsuranceBetConfig });

  const [draft, setDraft] = useState<backendApi.InsuranceBetConfig | null>(null);

  useEffect(() => {
    if (data && draft === null) {
      setDraft(data);
    }
  }, [data, draft]);

  const saveMutation = useMutation({
    mutationFn: (config: backendApi.InsuranceBetConfig) => backendApi.setInsuranceBetConfig(config),
    onSuccess: (saved) => {
      setDraft(saved);
      void queryClient.invalidateQueries({ queryKey: insuranceBetQueryKey });
      toast.success('Insurance bet settings saved');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to save insurance bet settings')),
  });

  const isValid = draft !== null && Number.isFinite(draft.costPercent) && draft.costPercent >= 0 && draft.costPercent <= 100;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Insurance bet</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Lets a player pay the cost % below off their potential payout, on any single or accumulator bet,
        in exchange for their stake back as a freebet if the bet loses. Never combines with a freebet-
        funded bet, to avoid double-bonusing.
      </p>

      <div className="mt-4 max-w-md">
        {isPending && (
          <div className="space-y-2" aria-label="Loading insurance bet config" role="status">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        )}
        {isError && <p className="text-sm text-danger">Failed to load insurance bet config.</p>}

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
              <label htmlFor="cost-percent" className="block text-xs text-text-secondary">
                Cost %
              </label>
              <input
                id="cost-percent"
                type="text"
                inputMode="decimal"
                value={draft.costPercent}
                onChange={(event) => setDraft({ ...draft, costPercent: Number(event.target.value) })}
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
