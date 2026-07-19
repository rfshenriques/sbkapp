import { useId, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { placeBet } from '../../lib/backendApi';
import { useAuth } from '../auth/useAuth';
import { walletQueryKey } from '../wallet/useWallet';
import { useBetSlipStore, type BetSlipSelection } from './betSlipStore';

type BetSlipTab = 'singles' | 'accumulator';

interface SingleBetRowProps {
  selection: BetSlipSelection;
  isAuthenticated: boolean;
  /**
   * Confirmation is owned by the parent, not local state - onSuccess also
   * removes this selection (unmounting this row) in the same update, so any
   * local "placed!" state here would never get a chance to render.
   */
  onPlaced: (message: string) => void;
}

/** Its own useMutation/stake state, so placing one single doesn't disable or affect any other row. */
function SingleBetRow({ selection, isAuthenticated, onPlaced }: SingleBetRowProps) {
  const removeSelection = useBetSlipStore((state) => state.removeSelection);
  const queryClient = useQueryClient();
  const [stake, setStake] = useState('10.00');
  const stakeId = useId();

  const placeBetMutation = useMutation({
    mutationFn: placeBet,
    onSuccess: (bet) => {
      onPlaced(
        `Bet placed! Stake ${(bet.stakeCents / 100).toFixed(2)}, potential payout ${(bet.potentialPayoutCents / 100).toFixed(2)}.`,
      );
      removeSelection(selection.matchId, selection.marketId);
      void queryClient.invalidateQueries({ queryKey: walletQueryKey });
    },
  });

  const stakeCents = Math.round(Number(stake) * 100);
  const isStakeValid = Number.isFinite(stakeCents) && stakeCents > 0;
  const potentialPayout = isStakeValid ? ((stakeCents * selection.odds) / 100).toFixed(2) : '—';

  return (
    <Card className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-text-muted">{selection.matchLabel}</p>
          <p className="text-sm font-medium">
            {selection.marketName}: {selection.selectionName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">{selection.odds.toFixed(2)}</span>
          <button
            type="button"
            aria-label={`Remove ${selection.selectionName} for ${selection.matchLabel}`}
            className="text-text-muted hover:text-danger"
            onClick={() => removeSelection(selection.matchId, selection.marketId)}
          >
            ✕
          </button>
        </div>
      </div>

      {isAuthenticated ? (
        <>
          <div>
            <label htmlFor={stakeId} className="block text-xs text-text-secondary">
              Stake
            </label>
            <input
              id={stakeId}
              type="number"
              min="0.01"
              step="0.01"
              value={stake}
              onChange={(event) => setStake(event.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span>Potential payout</span>
            <span className="font-semibold text-text-primary">{potentialPayout}</span>
          </div>
          {placeBetMutation.isError && (
            <p className="text-xs text-danger">
              {placeBetMutation.error instanceof Error
                ? placeBetMutation.error.message
                : 'Failed to place bet'}
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-text-secondary">
          <Link to="/login" className="text-text-primary hover:underline">
            Log in
          </Link>{' '}
          to place a bet.
        </p>
      )}
      <Button
        variant="primary"
        className="w-full"
        disabled={!isAuthenticated || !isStakeValid || placeBetMutation.isPending}
        onClick={() => placeBetMutation.mutate({ selections: [selection], stakeCents })}
      >
        {placeBetMutation.isPending ? 'Placing…' : 'Place Bet'}
      </Button>
    </Card>
  );
}

export function BetSlipPanel() {
  const selections = useBetSlipStore((state) => state.selections);
  const removeSelection = useBetSlipStore((state) => state.removeSelection);
  const clear = useBetSlipStore((state) => state.clear);
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [stake, setStake] = useState('10.00');
  const [confirmation, setConfirmation] = useState<string | null>(null);
  // Fresh per mount (the mobile drawer remounts this on every open), so a
  // slip with 2+ selections always opens straight to Accumulator, and the
  // user can still switch tabs manually afterward.
  const [activeTab, setActiveTab] = useState<BetSlipTab>(() =>
    selections.length >= 2 ? 'accumulator' : 'singles',
  );
  const stakeId = useId();

  const placeBetMutation = useMutation({
    mutationFn: placeBet,
    onSuccess: (bet) => {
      clear();
      setConfirmation(
        `Bet placed! Stake ${(bet.stakeCents / 100).toFixed(2)}, potential payout ${(bet.potentialPayoutCents / 100).toFixed(2)}.`,
      );
      void queryClient.invalidateQueries({ queryKey: walletQueryKey });
    },
  });

  if (selections.length === 0) {
    return (
      <div className="space-y-3">
        {confirmation && <p className="text-sm text-brand">{confirmation}</p>}
        <p className="text-sm text-text-secondary">Your bet slip is empty.</p>
      </div>
    );
  }

  const showTabs = selections.length >= 2;
  const tab: BetSlipTab = showTabs ? activeTab : 'singles';
  const combinedOdds = selections.reduce((total, selection) => total * selection.odds, 1);
  const stakeCents = Math.round(Number(stake) * 100);
  const isStakeValid = Number.isFinite(stakeCents) && stakeCents > 0;
  const potentialPayout = isStakeValid ? ((stakeCents * combinedOdds) / 100).toFixed(2) : '—';

  function handlePlaceAccumulator() {
    setConfirmation(null);
    placeBetMutation.mutate({ selections, stakeCents });
  }

  return (
    <div className="space-y-3">
      {confirmation && <p className="text-sm text-brand">{confirmation}</p>}
      {showTabs && (
        <div className="flex gap-2" role="tablist" aria-label="Bet slip mode">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'singles'}
            className={`slash tab${tab === 'singles' ? ' active' : ''}`}
            onClick={() => setActiveTab('singles')}
          >
            Singles
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'accumulator'}
            className={`slash tab${tab === 'accumulator' ? ' active' : ''}`}
            onClick={() => setActiveTab('accumulator')}
          >
            Accumulator
          </button>
        </div>
      )}

      {tab === 'singles' && (
        <div className="space-y-3">
          {selections.map((selection) => (
            <SingleBetRow
              key={`${selection.matchId}-${selection.marketId}`}
              selection={selection}
              isAuthenticated={isAuthenticated}
              onPlaced={setConfirmation}
            />
          ))}
        </div>
      )}

      {tab === 'accumulator' && (
        <div className="space-y-3">
          {selections.map((selection) => (
            <Card
              key={`${selection.matchId}-${selection.marketId}`}
              className="flex items-start justify-between gap-2"
            >
              <div>
                <p className="text-xs text-text-muted">{selection.matchLabel}</p>
                <p className="text-sm font-medium">
                  {selection.marketName}: {selection.selectionName}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{selection.odds.toFixed(2)}</span>
                <button
                  type="button"
                  aria-label={`Remove ${selection.selectionName} for ${selection.matchLabel}`}
                  className="text-text-muted hover:text-danger"
                  onClick={() => removeSelection(selection.matchId, selection.marketId)}
                >
                  ✕
                </button>
              </div>
            </Card>
          ))}
          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="text-sm text-text-secondary">Combined odds</span>
            <span className="font-semibold">{combinedOdds.toFixed(2)}</span>
          </div>

          {isAuthenticated ? (
            <>
              <div>
                <label htmlFor={stakeId} className="block text-sm text-text-secondary">
                  Stake
                </label>
                <input
                  id={stakeId}
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={stake}
                  onChange={(event) => setStake(event.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-center justify-between text-sm text-text-secondary">
                <span>Potential payout</span>
                <span className="font-semibold text-text-primary">{potentialPayout}</span>
              </div>
              {placeBetMutation.isError && (
                <p className="text-sm text-danger">
                  {placeBetMutation.error instanceof Error
                    ? placeBetMutation.error.message
                    : 'Failed to place bet'}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-text-secondary">
              <Link to="/login" className="text-text-primary hover:underline">
                Log in
              </Link>{' '}
              to place a bet.
            </p>
          )}

          <Button
            variant="primary"
            className="w-full"
            disabled={!isAuthenticated || !isStakeValid || placeBetMutation.isPending}
            onClick={handlePlaceAccumulator}
          >
            {placeBetMutation.isPending ? 'Placing…' : 'Place Bet'}
          </Button>
        </div>
      )}

      <Button variant="secondary" onClick={clear} className="w-full">
        Clear
      </Button>
    </div>
  );
}
