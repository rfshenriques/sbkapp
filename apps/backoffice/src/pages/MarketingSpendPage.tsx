import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { toast, errorMessage } from '../features/toast/toastStore';
import * as backendApi from '../lib/backendApi';

const marketingSpendQueryKey = ['marketing-spend'] as const;

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

export default function MarketingSpendPage() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState('');
  const [channel, setChannel] = useState('');
  const [amount, setAmount] = useState('');

  const {
    data: entries,
    isPending,
    isError,
  } = useQuery({ queryKey: marketingSpendQueryKey, queryFn: () => backendApi.listMarketingSpend() });

  const createMutation = useMutation({
    mutationFn: () => backendApi.createMarketingSpend(date, channel, Math.round(Number(amount) * 100)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: marketingSpendQueryKey });
      setDate('');
      setChannel('');
      setAmount('');
      toast.success('Spend entry added');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to add spend entry')),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => backendApi.removeMarketingSpend(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: marketingSpendQueryKey });
      toast.success('Spend entry removed');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to remove spend entry')),
  });

  const parsedAmount = Number(amount);
  const isFormValid =
    date !== '' && channel.trim() !== '' && amount !== '' && Number.isFinite(parsedAmount) && parsedAmount > 0;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Marketing spend</h1>
      <p className="mt-1 text-sm text-text-secondary">
        A manual log of marketing spend by channel - there's no ad-platform integration yet, so entries
        are recorded here by hand and shown alongside registrations/GGR on the Registrations page.
      </p>

      <Card className="mt-4">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (isFormValid) createMutation.mutate();
          }}
        >
          <div>
            <label htmlFor="spend-date" className="block text-xs text-text-secondary">
              Date
            </label>
            <input
              id="spend-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="spend-channel" className="block text-xs text-text-secondary">
              Channel
            </label>
            <input
              id="spend-channel"
              type="text"
              placeholder="e.g. Google Ads"
              value={channel}
              onChange={(event) => setChannel(event.target.value)}
              className="mt-1 w-40 rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="spend-amount" className="block text-xs text-text-secondary">
              Amount
            </label>
            <input
              id="spend-amount"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="mt-1 w-28 rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={!isFormValid || createMutation.isPending}
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add entry
          </button>
        </form>
        {createMutation.isError && (
          <p className="mt-2 text-sm text-danger">{(createMutation.error as Error).message}</p>
        )}
      </Card>

      <Card className="mt-4 overflow-x-auto">
        {isPending && (
          <div className="space-y-2" aria-label="Loading content" role="status">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        )}
        {isError && <p className="text-sm text-danger">Failed to load marketing spend.</p>}
        {entries && entries.length === 0 && (
          <p className="text-sm text-text-secondary">No spend entries recorded yet.</p>
        )}
        {entries && entries.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-text-secondary">
                <th className="py-2 pr-4 font-medium">Date</th>
                <th className="py-2 pr-4 font-medium">Channel</th>
                <th className="py-2 pr-4 font-medium">Amount</th>
                <th className="py-2 pr-4 font-medium">Added by</th>
                <th className="py-2 pr-4 font-medium" />
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-border last:border-0">
                  <td className="py-2 pr-4">{new Date(entry.date).toLocaleDateString()}</td>
                  <td className="py-2 pr-4">{entry.channel}</td>
                  <td className="py-2 pr-4">{formatCents(entry.amountCents)}</td>
                  <td className="py-2 pr-4 text-text-secondary">{entry.createdByUsername}</td>
                  <td className="py-2 pr-4 text-right">
                    <button
                      type="button"
                      onClick={() => removeMutation.mutate(entry.id)}
                      disabled={removeMutation.isPending}
                      className="text-xs font-medium text-danger hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
