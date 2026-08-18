import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cashOut, getCashoutQuote, type PlacedBet } from '../../lib/backendApi';
import { formatMoney } from '../../lib/currency';
import { track } from '../../lib/analytics';
import { walletQueryKey } from '../wallet/useWallet';
import { betsQueryKey } from './useBets';
import { useCashoutConfig } from './useCashoutConfig';

/**
 * PENDING-bet-only early cashout - see apps/backend's PamService.cashOut for
 * the money math (live combined odds vs placement odds, minus the brand's
 * configured margin). Quote is polled while the button is visible since the
 * offered amount tracks live odds, not just a one-time snapshot; cashOut
 * itself always recomputes fresh server-side rather than trusting whatever
 * quote is currently on screen, so a slightly stale display never risks
 * crediting the wrong amount. Renders nothing at all when the brand hasn't
 * enabled cashout, or when this exact bet currently has no reliable live
 * price (e.g. a leg's market is suspended) - same "omit rather than show a
 * broken control" rule the rest of this feature set follows.
 */
export function CashoutButton({ bet }: { bet: PlacedBet }) {
  const cashoutConfig = useCashoutConfig();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quoteQuery = useQuery({
    queryKey: ['cashout-quote', bet.id],
    queryFn: () => getCashoutQuote(bet.id),
    enabled: cashoutConfig.enabled,
    refetchInterval: 15_000,
  });

  const mutation = useMutation({
    mutationFn: () => cashOut(bet.id),
    onSuccess: (cashedOutBet) => {
      track('BET_CASHED_OUT', {
        metadata: { betId: bet.id, cashedOutValueCents: cashedOutBet.cashedOutValueCents },
      });
      void queryClient.invalidateQueries({ queryKey: walletQueryKey });
      void queryClient.invalidateQueries({ queryKey: betsQueryKey });
      setConfirming(false);
    },
    onError: (mutationError: unknown) => {
      setError(mutationError instanceof Error ? mutationError.message : 'Failed to cash out');
    },
  });

  if (!cashoutConfig.enabled || !quoteQuery.data?.available) {
    return null;
  }
  const { cashoutValueCents } = quoteQuery.data;

  if (confirming) {
    return (
      <div className="space-y-2">
        <p className="text-center text-sm text-text-secondary">
          Cash out now for <span className="font-semibold text-text">{formatMoney(cashoutValueCents)}</span>?
        </p>
        {error && <p className="text-center text-xs text-danger">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="btn-ghost flex-1"
            disabled={mutation.isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            className="btn-primary flex-1"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Cashing out…' : 'Confirm'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setError(null);
        setConfirming(true);
      }}
      className="btn-primary w-full"
    >
      Cash Out {formatMoney(cashoutValueCents)}
    </button>
  );
}
