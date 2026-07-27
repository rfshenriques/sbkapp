import type { ReactNode } from 'react';

/**
 * Solid highlight pill for a bet's headline price - introduced for
 * BetPlacedModal's payout-row odds/combined-odds figure, reused by
 * betCardShared (bet history, detail modal, win celebration) for a bet's own
 * odds (singles) or combined odds (accumulators) so the same number always
 * reads identically wherever it's the headline figure for that bet.
 * Per-leg odds inside an expanded accumulator stay plain text, not this
 * badge - only the one "total" price gets the highlight treatment.
 */
export function OddsBadge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-block rounded-lg bg-highlight font-display text-black ${className}`}>{children}</span>
  );
}
