import { useEffect, useState } from 'react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { BetReceipt, formatEuros } from './betCardShared';
import { useBets } from './useBets';
import { useWinCelebrationStore } from './winCelebrationStore';

/**
 * Two-step full-screen moment triggered by useWinCelebrationDetector right
 * after a bet flips to WON: step 1 is a plain congratulations + the amount
 * won, step 2 hands off to the shared BetReceipt "receipt" view so this
 * never shows different numbers than the rest of the app for the same bet.
 */
export function WinCelebrationModal() {
  const betId = useWinCelebrationStore((state) => state.betId);
  const close = useWinCelebrationStore((state) => state.close);
  const { data: bets } = useBets();
  const [step, setStep] = useState<1 | 2>(1);
  const bet = betId ? bets?.find((candidate) => candidate.id === betId) : undefined;

  useEffect(() => {
    if (betId) {
      setStep(1);
    }
  }, [betId]);

  if (!betId || !bet) {
    return null;
  }

  const payoutCents = bet.settledPayoutCents ?? 0;

  return (
    <BottomSheet
      title="You won!"
      icon={
        <span aria-hidden="true" className="text-xl">
          🏆
        </span>
      }
      onClose={close}
      closeLabel="Close"
      headerExtra={
        <div className="mt-2 flex gap-1.5" aria-hidden="true">
          <span className={`h-1 flex-1 rounded-full ${step >= 1 ? 'bg-highlight' : 'bg-surface-2'}`} />
          <span className={`h-1 flex-1 rounded-full ${step >= 2 ? 'bg-highlight' : 'bg-surface-2'}`} />
        </div>
      }
      footer={
        step === 1 ? (
          <button type="button" onClick={() => setStep(2)} className="btn-primary w-full">
            See bet
          </button>
        ) : (
          <button type="button" onClick={close} className="btn-primary w-full">
            Done
          </button>
        )
      }
    >
      {step === 1 ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <span
            aria-hidden="true"
            className="flex h-16 w-16 items-center justify-center rounded-full bg-highlight/15 text-4xl"
          >
            🏆
          </span>
          <p className="font-display text-2xl">Congratulations!</p>
          <p className="font-display text-5xl leading-none text-price-up">{formatEuros(payoutCents)}</p>
          <p className="text-sm text-text-secondary">Your bet won</p>
        </div>
      ) : (
        <BetReceipt bet={bet} />
      )}
    </BottomSheet>
  );
}
