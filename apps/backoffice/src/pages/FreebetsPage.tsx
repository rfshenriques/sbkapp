import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import * as backendApi from '../lib/backendApi';

function freebetsQueryKey(identifier: string) {
  return ['freebets', identifier] as const;
}

function formatEuros(cents: number): string {
  return (cents / 100).toFixed(2);
}

function statusBadgeClasses(status: backendApi.FreebetStatus): string {
  if (status === 'ACTIVE') return 'bg-highlight/20 text-highlight';
  if (status === 'SPENT') return 'bg-text-muted/20 text-text-secondary';
  return 'bg-danger/20 text-danger';
}

function GrantFreebetForm({ identifier }: { identifier: string }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [error, setError] = useState<string | null>(null);

  const grantMutation = useMutation({
    mutationFn: () =>
      backendApi.grantFreebet({
        identifier,
        amountCents: Math.round(Number(amount) * 100),
        note: note.trim() || undefined,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      }),
    onSuccess: () => {
      setAmount('');
      setNote('');
      setExpiresAt('');
      setError(null);
      void queryClient.invalidateQueries({ queryKey: freebetsQueryKey(identifier) });
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  const parsedAmount = Number(amount);
  const canSubmit = amount.trim() !== '' && Number.isFinite(parsedAmount) && parsedAmount > 0;

  return (
    <Card className="space-y-3">
      <h2 className="text-sm font-semibold">Grant a freebet to {identifier}</h2>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="Amount (€)"
          aria-label="Freebet amount"
          className="w-32 rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <input
          type="text"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Note (optional)"
          aria-label="Freebet note"
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={expiresAt}
          onChange={(event) => setExpiresAt(event.target.value)}
          aria-label="Freebet expiry date (optional)"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <Button
          variant="primary"
          disabled={!canSubmit || grantMutation.isPending}
          onClick={() => grantMutation.mutate()}
        >
          Grant
        </Button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </Card>
  );
}

function FreebetRow({ grant, identifier }: { grant: backendApi.FreebetGrant; identifier: string }) {
  const queryClient = useQueryClient();
  const voidMutation = useMutation({
    mutationFn: () => backendApi.voidFreebet(grant.id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: freebetsQueryKey(identifier) }),
  });

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-background px-3 py-2 text-sm">
      <div className="min-w-0">
        <span className="font-semibold">
          €{formatEuros(grant.amountCents)}
          {grant.status === 'ACTIVE' && grant.remainingCents < grant.amountCents && (
            <span className="font-normal text-text-secondary"> (€{formatEuros(grant.remainingCents)} left)</span>
          )}
        </span>{' '}
        <span className={`rounded px-1.5 py-0.5 text-xs ${statusBadgeClasses(grant.status)}`}>{grant.status}</span>
        <div className="text-xs text-text-muted">
          {grant.source === 'MANUAL' ? `Granted by ${grant.createdByUsername ?? 'staff'}` : grant.source}
          {grant.note && ` — ${grant.note}`}
          {grant.expiresAt && ` — expires ${new Date(grant.expiresAt).toLocaleDateString()}`}
        </div>
      </div>
      {grant.status === 'ACTIVE' && (
        <Button variant="danger" disabled={voidMutation.isPending} onClick={() => voidMutation.mutate()}>
          Void
        </Button>
      )}
    </div>
  );
}

/**
 * A freebet grant credits the player's pooled freebets balance (see
 * FreebetService.spendFromBalance) - a bet can draw any typed stake from
 * it, so a grant is often partially drawn down rather than spent all at
 * once. This page is a per-player lookup, not a flat list, since there's
 * no "all freebets" use case yet - a trader/CRM staff member always
 * starts from a specific player (support ticket, goodwill gesture,
 * campaign reward correction).
 */
export default function FreebetsPage() {
  const [identifierInput, setIdentifierInput] = useState('');
  const [lookedUp, setLookedUp] = useState<string | null>(null);

  const {
    data: grants,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: freebetsQueryKey(lookedUp ?? ''),
    queryFn: () => backendApi.listFreebets(lookedUp as string),
    enabled: lookedUp !== null,
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Freebets</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Look up a player by email or username to see their freebet history, grant a new one, or void an
        active one before it's used.
      </p>

      <Card className="mt-4 space-y-3">
        <h2 className="text-sm font-semibold">Look up a player</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={identifierInput}
            onChange={(event) => setIdentifierInput(event.target.value)}
            placeholder="Player email or username"
            aria-label="Player email or username"
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <Button
            variant="primary"
            disabled={identifierInput.trim() === ''}
            onClick={() => setLookedUp(identifierInput.trim())}
          >
            Look up
          </Button>
        </div>
      </Card>

      {lookedUp && (
        <div className="mt-4 space-y-4">
          <GrantFreebetForm identifier={lookedUp} />

          {isPending && <p className="text-sm text-text-secondary">Loading…</p>}
          {isError && (
            <p className="text-sm text-danger">
              {error instanceof Error ? error.message : 'Failed to load freebets.'}
            </p>
          )}
          {!isPending && !isError && grants?.length === 0 && (
            <p className="text-sm text-text-secondary">No freebets for this player yet.</p>
          )}
          {grants && grants.length > 0 && (
            <div className="space-y-2">
              {grants.map((grant) => (
                <FreebetRow key={grant.id} grant={grant} identifier={lookedUp} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
