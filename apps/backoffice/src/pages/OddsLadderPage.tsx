import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { toast, errorMessage } from '../features/toast/toastStore';
import * as backendApi from '../lib/backendApi';

const ladderQueryKey = ['odds-ladder'] as const;

export default function OddsLadderPage() {
  const queryClient = useQueryClient();
  const [draftValue, setDraftValue] = useState('');

  const {
    data: rungs,
    isPending,
    isError,
  } = useQuery({ queryKey: ladderQueryKey, queryFn: backendApi.listOddsLadderRungs });

  const addMutation = useMutation({
    mutationFn: (value: number) => backendApi.addOddsLadderRung(value),
    onSuccess: () => {
      setDraftValue('');
      void queryClient.invalidateQueries({ queryKey: ladderQueryKey });
      toast.success('Rung added');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to add rung')),
  });
  const removeMutation = useMutation({
    mutationFn: (id: string) => backendApi.removeOddsLadderRung(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ladderQueryKey });
      toast.success('Rung removed');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to remove rung')),
  });
  const generateMutation = useMutation({
    mutationFn: () => backendApi.generateStandardOddsLadder(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ladderQueryKey });
      toast.success('Standard ladder generated');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to generate ladder')),
  });

  const parsedDraft = draftValue === '' ? null : Number(draftValue);
  const isDraftValid = parsedDraft !== null && Number.isFinite(parsedDraft) && parsedDraft > 1;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Odds ladder</h1>
      <p className="mt-1 text-sm text-text-secondary">
        The price grid Boosts climb - a boosted selection always lands on one of these rungs, never a
        made-up price. Generate the standard grid to start, then add or remove individual rungs as
        needed.
      </p>

      <div className="mt-4">
        <Button
          variant="secondary"
          disabled={generateMutation.isPending}
          onClick={() => generateMutation.mutate()}
        >
          Generate standard ladder (replaces current)
        </Button>
      </div>

      <Card className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            inputMode="decimal"
            placeholder="e.g. 2.50"
            aria-label="New rung value"
            value={draftValue}
            onChange={(event) => setDraftValue(event.target.value)}
            className="w-28 rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text-primary"
          />
          <Button
            variant="primary"
            disabled={!isDraftValid || addMutation.isPending}
            onClick={() => addMutation.mutate(parsedDraft as number)}
          >
            Add rung
          </Button>
        </div>

        <div className="mt-4">
          {isPending && (
            <div className="space-y-2" aria-label="Loading odds ladder" role="status">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          )}
          {isError && <p className="text-sm text-danger">Failed to load odds ladder.</p>}
          {!isPending && rungs?.length === 0 && (
            <p className="text-sm text-text-secondary">
              No rungs configured yet - generate the standard ladder to get started.
            </p>
          )}
          {rungs && rungs.length > 0 && (
            <>
              <p className="mb-2 text-xs text-text-muted">{rungs.length} rungs</p>
              <div className="flex max-h-96 flex-wrap gap-1.5 overflow-y-auto">
                {rungs.map((rung) => (
                  <span
                    key={rung.id}
                    className="flex items-center gap-1 rounded-full border border-border bg-background px-2 py-1 text-xs tabular-nums text-text-secondary"
                  >
                    {rung.value.toFixed(2)}
                    <button
                      type="button"
                      aria-label={`Remove rung ${rung.value.toFixed(2)}`}
                      disabled={removeMutation.isPending}
                      onClick={() => removeMutation.mutate(rung.id)}
                      className="text-text-muted hover:text-danger"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
