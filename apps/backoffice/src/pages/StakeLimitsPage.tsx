import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import * as backendApi from '../lib/backendApi';
import type { LimitScope, StakeLimit } from '../lib/backendApi';

const stakeLimitsQueryKey = ['stake-limits'] as const;
const SCOPES: LimitScope[] = ['GLOBAL', 'SPORT', 'COUNTRY', 'LEAGUE', 'MARKET'];
const TIERS = [0, 1, 2, 3, 4] as const;

function draftToCentsOrNull(draft: string): number | null {
  return draft.trim() === '' ? null : Math.round(Number(draft) * 100);
}

function isValidAmountDraft(draft: string): boolean {
  if (draft.trim() === '') return true;
  const value = Number(draft);
  return Number.isFinite(value) && value >= 0;
}

function scopeLabel(scope: LimitScope): string {
  switch (scope) {
    case 'GLOBAL':
      return 'Global';
    case 'SPORT':
      return 'Sport';
    case 'COUNTRY':
      return 'Country';
    case 'LEAGUE':
      return 'League';
    case 'MARKET':
      return 'Market';
  }
}

function NewLimitForm() {
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<LimitScope>('SPORT');
  const [scopeValue, setScopeValue] = useState('');
  const [tier, setTier] = useState(0);
  const [maxStakeDraft, setMaxStakeDraft] = useState('');
  const [maxLiabilityDraft, setMaxLiabilityDraft] = useState('');

  const setMutation = useMutation({
    mutationFn: backendApi.setStakeLimit,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: stakeLimitsQueryKey });
      setScopeValue('');
      setMaxStakeDraft('');
      setMaxLiabilityDraft('');
    },
  });

  const needsScopeValue = scope !== 'GLOBAL';
  const isValid =
    (!needsScopeValue || scopeValue.trim() !== '') &&
    isValidAmountDraft(maxStakeDraft) &&
    isValidAmountDraft(maxLiabilityDraft) &&
    (maxStakeDraft.trim() !== '' || maxLiabilityDraft.trim() !== '');

  return (
    <Card className="space-y-3">
      <h2 className="text-sm font-semibold text-text-primary">Add a limit</h2>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          Scope
          <select
            value={scope}
            onChange={(event) => setScope(event.target.value as LimitScope)}
            className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text-primary"
          >
            {SCOPES.map((option) => (
              <option key={option} value={option}>
                {scopeLabel(option)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          {needsScopeValue ? `${scopeLabel(scope)} name` : 'Scope value'}
          <input
            type="text"
            disabled={!needsScopeValue}
            placeholder={needsScopeValue ? 'e.g. Football' : 'n/a'}
            value={needsScopeValue ? scopeValue : ''}
            onChange={(event) => setScopeValue(event.target.value)}
            className="w-40 rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text-primary disabled:opacity-50"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          Tier
          <select
            value={tier}
            onChange={(event) => setTier(Number(event.target.value))}
            className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text-primary"
          >
            {TIERS.map((option) => (
              <option key={option} value={option}>
                {option === 0 ? 'All tiers' : `Tier ${option}`}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          Max stake (EUR)
          <input
            type="text"
            inputMode="decimal"
            placeholder="No cap"
            value={maxStakeDraft}
            onChange={(event) => setMaxStakeDraft(event.target.value)}
            className="w-28 rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text-primary"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          Max liability (EUR)
          <input
            type="text"
            inputMode="decimal"
            placeholder="No cap"
            value={maxLiabilityDraft}
            onChange={(event) => setMaxLiabilityDraft(event.target.value)}
            className="w-28 rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text-primary"
          />
        </label>

        <Button
          disabled={!isValid || setMutation.isPending}
          onClick={() =>
            setMutation.mutate({
              scope,
              scopeValue: needsScopeValue ? scopeValue.trim() : '',
              tier,
              maxStakeCents: draftToCentsOrNull(maxStakeDraft),
              maxLiabilityCents: draftToCentsOrNull(maxLiabilityDraft),
            })
          }
        >
          {setMutation.isPending ? 'Saving…' : 'Add limit'}
        </Button>
      </div>
      {setMutation.isError && <p className="text-xs text-danger">Failed to save the limit.</p>}
    </Card>
  );
}

function LimitRow({ limit }: { limit: StakeLimit }) {
  const queryClient = useQueryClient();
  const removeMutation = useMutation({
    mutationFn: () => backendApi.removeStakeLimit(limit.id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: stakeLimitsQueryKey }),
  });

  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-2 pr-4">{scopeLabel(limit.scope)}</td>
      <td className="py-2 pr-4">{limit.scope === 'GLOBAL' ? '—' : limit.scopeValue}</td>
      <td className="py-2 pr-4">{limit.tier === 0 ? 'All' : limit.tier}</td>
      <td className="py-2 pr-4">
        {limit.maxStakeCents === null ? '—' : `${(limit.maxStakeCents / 100).toFixed(2)} €`}
      </td>
      <td className="py-2 pr-4">
        {limit.maxLiabilityCents === null ? '—' : `${(limit.maxLiabilityCents / 100).toFixed(2)} €`}
      </td>
      <td className="py-2 pr-4 text-right">
        <Button variant="danger" disabled={removeMutation.isPending} onClick={() => removeMutation.mutate()}>
          Remove
        </Button>
      </td>
    </tr>
  );
}

function ExcelTools() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const exportMutation = useMutation({
    mutationFn: backendApi.exportStakeLimits,
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'stake-limits.xlsx';
      link.click();
      URL.revokeObjectURL(url);
    },
  });

  const importMutation = useMutation({
    mutationFn: backendApi.importStakeLimits,
    onSuccess: (result) => {
      setImportMessage(`Imported ${result.count} row(s), removed ${result.removedCount} old row(s).`);
      void queryClient.invalidateQueries({ queryKey: stakeLimitsQueryKey });
    },
    onError: (error: unknown) => {
      setImportMessage(error instanceof Error ? error.message : 'Import failed.');
    },
  });

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="secondary" disabled={exportMutation.isPending} onClick={() => exportMutation.mutate()}>
        {exportMutation.isPending ? 'Downloading…' : 'Download Excel'}
      </Button>
      <Button
        variant="secondary"
        disabled={importMutation.isPending}
        onClick={() => fileInputRef.current?.click()}
      >
        {importMutation.isPending ? 'Uploading…' : 'Upload Excel'}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            setImportMessage(null);
            importMutation.mutate(file);
          }
          event.target.value = '';
        }}
      />
      {importMessage && <p className="text-xs text-text-secondary">{importMessage}</p>}
    </div>
  );
}

export default function StakeLimitsPage() {
  const {
    data: limits,
    isPending,
    isError,
  } = useQuery({ queryKey: stakeLimitsQueryKey, queryFn: backendApi.listStakeLimits });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Stake &amp; liability limits</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Max stake and max liability per sport/country/league/market, optionally narrowed to one pricing
        tier. The most specific matching row wins for each field independently (market beats league beats
        country beats sport beats global). An accumulator uses the smallest cap across all of its legs -
        one leg capped at 1000 € and another at 400 € caps the whole bet at 400 €. Download the current
        limits as Excel, edit them there, and re-upload - the uploaded file replaces the brand's whole
        limit set.
      </p>

      <div className="mt-4 space-y-4">
        <NewLimitForm />
        <ExcelTools />

        {isPending && (
          <div className="space-y-2" aria-label="Loading stake limits" role="status">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        )}
        {isError && <p className="text-sm text-danger">Failed to load stake limits.</p>}
        {limits?.length === 0 && (
          <p className="text-sm text-text-secondary">No limits configured yet - bets are unbounded.</p>
        )}
        {limits && limits.length > 0 && (
          <Card className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-text-secondary">
                  <th className="py-2 pr-4 font-medium">Scope</th>
                  <th className="py-2 pr-4 font-medium">Value</th>
                  <th className="py-2 pr-4 font-medium">Tier</th>
                  <th className="py-2 pr-4 font-medium">Max stake</th>
                  <th className="py-2 pr-4 font-medium">Max liability</th>
                  <th className="py-2 pr-4" />
                </tr>
              </thead>
              <tbody>
                {limits.map((limit) => (
                  <LimitRow key={limit.id} limit={limit} />
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}
