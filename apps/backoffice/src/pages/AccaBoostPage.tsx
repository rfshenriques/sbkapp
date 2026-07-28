import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { toast, errorMessage } from '../features/toast/toastStore';
import * as backendApi from '../lib/backendApi';

const accaBoostQueryKey = ['acca-boost-config'] as const;

export default function AccaBoostPage() {
  const queryClient = useQueryClient();
  const {
    data,
    isPending,
    isError,
  } = useQuery({ queryKey: accaBoostQueryKey, queryFn: backendApi.getAccaBoostConfig });

  const [draft, setDraft] = useState<backendApi.AccaBoostConfig | null>(null);

  useEffect(() => {
    if (data && draft === null) {
      setDraft(data);
    }
  }, [data, draft]);

  const saveMutation = useMutation({
    mutationFn: (config: backendApi.AccaBoostConfig) => backendApi.setAccaBoostConfig(config),
    onSuccess: (saved) => {
      setDraft(saved);
      void queryClient.invalidateQueries({ queryKey: accaBoostQueryKey });
      toast.success('Acca boost settings saved');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to save acca boost settings')),
  });

  const isValid =
    draft !== null &&
    Number.isFinite(draft.boostPercentPerLeg) &&
    draft.boostPercentPerLeg >= 0 &&
    Number.isInteger(draft.minSelections) &&
    draft.minSelections >= 2 &&
    Number.isFinite(draft.minOddsPerLeg) &&
    draft.minOddsPerLeg > 1;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Acca boost</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Automatically boosts a qualifying accumulator's combined odds by the percent below, added once
        per selection - a 4-selection acca at 5%/leg gets +20%. Applies only when every leg meets the
        minimum odds and the bet has at least the minimum number of selections.
      </p>

      <div className="mt-4 max-w-md">
        {isPending && (
          <div className="space-y-2" aria-label="Loading acca boost config" role="status">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        )}
        {isError && <p className="text-sm text-danger">Failed to load acca boost config.</p>}

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
              <label htmlFor="boost-percent" className="block text-xs text-text-secondary">
                Boost % per leg
              </label>
              <input
                id="boost-percent"
                type="text"
                inputMode="decimal"
                value={draft.boostPercentPerLeg}
                onChange={(event) => setDraft({ ...draft, boostPercentPerLeg: Number(event.target.value) })}
                className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text-primary"
              />
            </div>

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
              <label htmlFor="min-odds" className="block text-xs text-text-secondary">
                Min odds per leg
              </label>
              <input
                id="min-odds"
                type="text"
                inputMode="decimal"
                value={draft.minOddsPerLeg}
                onChange={(event) => setDraft({ ...draft, minOddsPerLeg: Number(event.target.value) })}
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
