import type { ReactNode } from 'react';
import { MoneyBeforeAfter } from '../../components/ui/MoneyBeforeAfter';
import { ClockIcon } from '../../components/ui/NavIcons';
import { betStatusBadgeClasses, betStatusLabel, betStatusTextClasses } from '../../lib/betStatus';
import type { PlacedBet, PlacedBetSelection } from '../../lib/backendApi';

export function formatEuros(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}

/**
 * combinedOdds/potentialPayoutCents already have any acca boost/insurance
 * baked in as of placement time (see PamService.placeBet) - the
 * pre-boost/pre-insurance values are re-derived here rather than stored
 * redundantly, same "recompute, don't trust a stored derived value"
 * convention PamService.settleSelection itself follows.
 */
export function unboostedCombinedOdds(bet: PlacedBet): number {
  return Number(bet.combinedOdds) / (1 + bet.accaBoostPercent / 100);
}

export function displayedPayoutCents(bet: PlacedBet): number {
  return bet.status === 'PENDING' ? bet.potentialPayoutCents : (bet.settledPayoutCents ?? 0);
}

export function uninsuredPayoutCents(bet: PlacedBet): number {
  return Math.round(displayedPayoutCents(bet) / (1 - bet.insuranceCostPercent / 100));
}

export function BetTag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
      {children}
    </span>
  );
}

/** Small filled circle per accumulator leg - a check/cross/dash glyph once a leg has settled, a clock while still OPEN. Collapsed-state summary so a player can see at a glance how an accumulator is going without expanding it. */
export function SelectionStatusDot({ status }: { status: PlacedBetSelection['status'] }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold leading-none ${betStatusBadgeClasses(status)}`}
    >
      {status === 'WON' ? '✓' : status === 'LOST' ? '✕' : status === 'VOID' ? '–' : <ClockIcon width={11} height={11} />}
    </span>
  );
}

export function SelectionRow({ selection }: { selection: PlacedBetSelection }) {
  return (
    <div className="text-sm">
      <p className="text-xs text-text-muted">{selection.matchLabel}</p>
      <p>
        <span className={betStatusTextClasses(selection.status)}>
          {selection.marketName}: {selection.selectionName}
        </span>{' '}
        <span className="text-text-secondary">@ {Number(selection.odds).toFixed(2)}</span>
      </p>
    </div>
  );
}

/** Status badge + type/freebet/insured/boosted tags - the same cluster shown atop a bet everywhere it appears (list card, full detail, win celebration). */
export function BetBadgesRow({ bet }: { bet: PlacedBet }) {
  const isAccumulator = bet.selections.length > 1;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest ${betStatusBadgeClasses(bet.status)}`}
      >
        {betStatusLabel(bet.status)}
      </span>
      <BetTag>{isAccumulator ? `Accumulator (${bet.selections.length})` : 'Single'}</BetTag>
      {bet.fundedByFreebets && <BetTag>Freebet</BetTag>}
      {bet.insuranceCostPercent > 0 && <BetTag>Insured</BetTag>}
      {bet.accaBoostPercent > 0 && <BetTag>Boosted +{bet.accaBoostPercent}%</BetTag>}
    </div>
  );
}

/** Qualified-for-campaign / acca-rollback-refund notes - omitted entirely when neither applies. */
export function BetCampaignNotes({ bet }: { bet: PlacedBet }) {
  const campaignName = bet.betAndGetCampaignName ?? bet.depositCampaignName;
  if (!campaignName && bet.accaRollbackRewardCents === null) {
    return null;
  }
  return (
    <>
      {campaignName && <p className="text-xs text-highlight">Qualified for {campaignName}</p>}
      {bet.accaRollbackRewardCents !== null && (
        <p className="text-xs text-highlight">
          {formatEuros(bet.accaRollbackRewardCents)} refunded as a freebet (Acca Rollback)
        </p>
      )}
    </>
  );
}

/** Stake / combined-odds / payout summary line - the footer every bet card ends on. */
export function BetFooterSummary({ bet }: { bet: PlacedBet }) {
  const isAccumulator = bet.selections.length > 1;
  const payoutCents = displayedPayoutCents(bet);
  const showInsuranceBeforeAfter = bet.insuranceCostPercent > 0 && payoutCents > 0;

  return (
    <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
      <span className="text-text-secondary">
        Stake {formatEuros(bet.stakeCents)}
        {isAccumulator &&
          (bet.accaBoostPercent > 0 ? (
            <>
              {' '}
              · Combined odds {unboostedCombinedOdds(bet).toFixed(2)} &rarr; {Number(bet.combinedOdds).toFixed(2)}
            </>
          ) : (
            ` · Combined odds ${Number(bet.combinedOdds).toFixed(2)}`
          ))}
      </span>
      <span className="font-semibold">
        {showInsuranceBeforeAfter ? (
          <MoneyBeforeAfter beforeCents={uninsuredPayoutCents(bet)} afterCents={payoutCents} />
        ) : bet.status === 'PENDING' ? (
          `Potential ${formatEuros(payoutCents)}`
        ) : (
          `Payout ${formatEuros(payoutCents)}`
        )}
      </span>
    </div>
  );
}

/** Every selection, always expanded, with its own status dot - the "receipt" body shared by the full detail modal and step 2 of the win celebration flow. */
export function BetSelectionsList({ bet }: { bet: PlacedBet }) {
  return (
    <div className="space-y-2">
      {bet.selections.map((selection) => (
        <div key={selection.id} className="flex items-start gap-2">
          <SelectionStatusDot status={selection.status} />
          <div className="flex-1">
            <SelectionRow selection={selection} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** The full bet "receipt" - badges, every selection, campaign/rollback notes, footer summary. Shared by BetDetailModal and step 2 of WinCelebrationModal so the two never drift apart. */
export function BetReceipt({ bet }: { bet: PlacedBet }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BetBadgesRow bet={bet} />
        <span className="text-xs text-text-muted">
          {new Date(bet.createdAt).toLocaleString(undefined, {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
      <BetSelectionsList bet={bet} />
      <BetCampaignNotes bet={bet} />
      <BetFooterSummary bet={bet} />
    </div>
  );
}
