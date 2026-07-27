import { useState, type ReactNode } from 'react';
import { MoneyBeforeAfter } from '../../components/ui/MoneyBeforeAfter';
import { ClockIcon, FreebetBadgeIcon, ShareIcon } from '../../components/ui/NavIcons';
import { OddsBadge } from '../../components/ui/OddsBadge';
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

/**
 * "Home vs Away" as a bordered, boxed row - the framed match-info strip
 * every selection sits above in the reference layout. The reference also
 * shows a live score/kickoff time in the middle of this box, but neither is
 * part of PlacedBetSelection (no live score or kickoff is ever stored on a
 * bet - see PamService), so that middle slot is left out entirely rather
 * than faked. matchLabel is always built client-side as
 * "${homeTeam} vs ${awayTeam}" (see OddsBoardPage) - split back apart here
 * for the two-sided layout, falling back to the raw label if that ever
 * doesn't hold.
 */
function MatchInfoBox({ matchLabel }: { matchLabel: string }) {
  const [home, away] = matchLabel.split(' vs ');
  return (
    <div className="rounded-xl border border-border px-3 py-2 text-xs text-text-secondary">
      {home && away ? (
        <div className="flex items-center justify-between gap-2">
          <span>{home}</span>
          <span>{away}</span>
        </div>
      ) : (
        <span>{matchLabel}</span>
      )}
    </div>
  );
}

/**
 * oddsVariant 'badge' is only for a single (non-accumulator) bet's own odds
 * - the highlight pill from the bet-placed confirmation modal, reused here
 * as that bet's headline price (see BetSelectionsList). A leg inside an
 * expanded accumulator always stays 'plain' - only the one combined-odds
 * figure gets the badge treatment there (see BetFooterSummary).
 *
 * `dense` drops the bordered MatchInfoBox in favor of a single muted text
 * line - the boxed match-info row reads fine as the sole selection on a
 * single-bet card or in the dedicated full-screen receipt (BetDetailModal/
 * WinCelebrationModal), but repeated once per leg inside an inline
 * accumulator accordion (see BetHistoryList's BetCard) it turned every leg
 * into its own floating mini-card, with no visual link between them. Dense
 * rows are meant to sit inside one shared bordered/divided container instead
 * (see BetCard's expanded-legs list) so the whole accumulator reads as one
 * connected list.
 */
export function SelectionRow({
  selection,
  oddsVariant = 'plain',
  dense = false,
}: {
  selection: PlacedBetSelection;
  oddsVariant?: 'plain' | 'badge';
  dense?: boolean;
}) {
  return (
    <div className={dense ? 'space-y-0.5 text-sm' : 'space-y-1.5 text-sm'}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p
            className={`font-display leading-tight ${dense ? 'text-sm' : 'text-base'} ${betStatusTextClasses(selection.status)}`}
          >
            {selection.selectionName}
          </p>
          <p className="text-xs text-text-secondary">{selection.marketName}</p>
        </div>
        {oddsVariant === 'badge' ? (
          <OddsBadge className="shrink-0 px-1.5 py-0.5 text-xs">{Number(selection.odds).toFixed(2)}</OddsBadge>
        ) : (
          <span className="shrink-0 text-text-secondary">{Number(selection.odds).toFixed(2)}</span>
        )}
      </div>
      {dense ? (
        <p className="text-xs text-text-muted">{selection.matchLabel}</p>
      ) : (
        <MatchInfoBox matchLabel={selection.matchLabel} />
      )}
    </div>
  );
}

/**
 * Bet-type label (plain text, not a pill) on the left, status pill on the
 * right - the reference only shows the status pill for a settled bet, but
 * OPEN is real, already-built status information (see betStatus.ts), so
 * it's kept here rather than dropped just because the reference has nothing
 * to show for a still-live bet. Insured/Boosted are real features the
 * reference has no equivalent of - kept as a secondary tag row underneath
 * instead of forcing them into the header line.
 */
export function BetCardHeader({ bet }: { bet: PlacedBet }) {
  const isAccumulator = bet.selections.length > 1;
  const isInsured = bet.insuranceCostPercent > 0;
  const hasExtraTags = isInsured || bet.accaBoostPercent > 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-base">
          {isAccumulator ? `Accumulator (${bet.selections.length})` : 'Single'}
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest ${betStatusBadgeClasses(bet.status, isInsured)}`}
        >
          {betStatusLabel(bet.status)}
        </span>
      </div>
      {hasExtraTags && (
        <div className="flex flex-wrap items-center gap-1.5">
          {bet.insuranceCostPercent > 0 && <BetTag>Insured</BetTag>}
          {bet.accaBoostPercent > 0 && <BetTag>Boosted +{bet.accaBoostPercent}%</BetTag>}
        </div>
      )}
    </div>
  );
}

/**
 * Qualified-for-campaign / acca-rollback-refund notes - omitted entirely
 * when none apply. A bet can qualify for a Bet & Get campaign and fulfil a
 * pending deposit campaign redemption at once (independent FK fields on
 * Bet - see PamService.placeBet), so both render when both apply, each
 * naming its own reward amount rather than just the campaign name.
 */
export function BetCampaignNotes({ bet }: { bet: PlacedBet }) {
  const campaignNotes = [
    { name: bet.betAndGetCampaignName, rewardCents: bet.betAndGetCampaignRewardCents },
    { name: bet.depositCampaignName, rewardCents: bet.depositCampaignRewardCents },
  ].filter((note): note is { name: string; rewardCents: number | null } => note.name !== null);

  if (campaignNotes.length === 0 && bet.accaRollbackRewardCents === null) {
    return null;
  }
  return (
    <>
      {campaignNotes.map((note) => (
        <p key={note.name} className="text-xs text-highlight">
          Qualified for {note.name}
          {note.rewardCents !== null && ` - ${formatEuros(note.rewardCents)} freebet`}
        </p>
      ))}
      {bet.accaRollbackRewardCents !== null && (
        <p className="text-xs text-highlight">
          {formatEuros(bet.accaRollbackRewardCents)} refunded as a freebet (Acca Rollback)
        </p>
      )}
    </>
  );
}

/** Combined odds / stake / payout, each its own row (label left, value right) - matches the reference's stacked Cota total / Montante / Ganhos rows rather than cramming them onto one line. */
export function BetFooterSummary({ bet }: { bet: PlacedBet }) {
  const isAccumulator = bet.selections.length > 1;
  const payoutCents = displayedPayoutCents(bet);
  const showInsuranceBeforeAfter = bet.insuranceCostPercent > 0 && payoutCents > 0;
  // A LOST insured bet never carries any of its stake in settledPayoutCents
  // (computeBetOutcome always pays 0 on LOST) - the stake instead comes back
  // as a separate freebet grant equal to bet.stakeCents (see
  // PamService.settleSelection's INSURANCE_BET grant), so that's what
  // belongs in the payout row here, not a bare "€0.00".
  const isInsuredLoss = bet.status === 'LOST' && bet.insuranceCostPercent > 0;

  return (
    <div className="space-y-1.5 border-t border-border pt-2 text-sm">
      {isAccumulator && (
        <div className="flex items-center justify-between">
          <span className="text-text-secondary">Combined odds</span>
          <span className="flex items-center gap-1.5">
            {bet.accaBoostPercent > 0 && (
              <span className="text-xs text-text-secondary line-through decoration-1">
                {unboostedCombinedOdds(bet).toFixed(2)}
              </span>
            )}
            <OddsBadge className="px-1.5 py-0.5 text-xs">{Number(bet.combinedOdds).toFixed(2)}</OddsBadge>
          </span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-text-secondary">Stake</span>
        <span className="flex items-center gap-1.5">
          {bet.fundedByFreebets && (
            <FreebetBadgeIcon width={15} height={15} className="shrink-0" role="img" aria-label="Funded by freebet" />
          )}
          {formatEuros(bet.stakeCents)}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-text-secondary">{bet.status === 'PENDING' ? 'Potential payout' : 'Payout'}</span>
        <span className="font-semibold">
          {isInsuredLoss ? (
            <span className="flex items-center gap-1.5">
              <FreebetBadgeIcon
                width={15}
                height={15}
                className="shrink-0"
                role="img"
                aria-label="Stake refunded as a freebet"
              />
              {formatEuros(bet.stakeCents)}
            </span>
          ) : showInsuranceBeforeAfter ? (
            <MoneyBeforeAfter beforeCents={uninsuredPayoutCents(bet)} afterCents={payoutCents} />
          ) : (
            formatEuros(payoutCents)
          )}
        </span>
      </div>
    </div>
  );
}

function shareTextForBet(bet: PlacedBet): string {
  const payoutCents = displayedPayoutCents(bet);
  const outcome = bet.status === 'WON' ? 'won' : bet.status === 'LOST' ? 'lost' : 'settled';
  if (bet.selections.length > 1) {
    return `My ${bet.selections.length}-selection accumulator ${outcome} - stake ${formatEuros(bet.stakeCents)}, combined odds ${Number(bet.combinedOdds).toFixed(2)}${bet.status === 'WON' ? `, payout ${formatEuros(payoutCents)}` : ''}.`;
  }
  const selection = bet.selections[0]!;
  return `My bet on ${selection.selectionName} (${selection.marketName}) ${outcome} - stake ${formatEuros(bet.stakeCents)} at odds ${Number(selection.odds).toFixed(2)}${bet.status === 'WON' ? `, payout ${formatEuros(payoutCents)}` : ''}.`;
}

/** Settled-bet-only share action - Web Share API with a clipboard fallback, same pattern as BetPlacedModal's own Share button. Omitted for a still-PENDING bet, matching the reference (which shows Cashout, not Share, for an open bet - we have neither a real cashout feature to build, so that slot is simply empty for an open bet). */
export function ShareBetButton({ bet }: { bet: PlacedBet }) {
  const [feedback, setFeedback] = useState<string | null>(null);

  if (bet.status === 'PENDING') {
    return null;
  }

  async function handleShare() {
    const text = shareTextForBet(bet);
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        // Cancelled or unsupported mid-call - no error state, same as just not sharing.
      }
      return;
    }
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        setFeedback('Copied to clipboard');
      } catch {
        // Best-effort only.
      }
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void handleShare()}
        className="btn-ghost flex w-full items-center justify-center gap-2"
      >
        <ShareIcon width={16} height={16} />
        Share
      </button>
      {feedback && <p className="mt-1 text-center text-xs text-text-secondary">{feedback}</p>}
    </div>
  );
}

/** "Ref <id> · <placed date>" footer line - the reference's own support-reference-and-timestamp row, using the bet's real id rather than a fabricated reference number. */
export function BetReferenceFooter({ bet }: { bet: PlacedBet }) {
  return (
    <div className="flex items-center justify-between border-t border-border pt-2 text-[11px] text-text-muted">
      <span>Ref {bet.id.replace(/-/g, '')}</span>
      <span>
        {new Date(bet.createdAt).toLocaleString(undefined, {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </span>
    </div>
  );
}

/** Every selection, always expanded, with its own status dot - the "receipt" body shared by the full detail modal and step 2 of the win celebration flow. */
export function BetSelectionsList({ bet }: { bet: PlacedBet }) {
  const oddsVariant = bet.selections.length === 1 ? 'badge' : 'plain';
  return (
    <div className="space-y-2">
      {bet.selections.map((selection) => (
        <div key={selection.id} className="flex items-start gap-2">
          <SelectionStatusDot status={selection.status} />
          <div className="flex-1">
            <SelectionRow selection={selection} oddsVariant={oddsVariant} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** The full bet "receipt" - header, every selection, campaign/rollback notes, footer summary, share, ref/date. Shared by BetDetailModal and step 2 of WinCelebrationModal so the two never drift apart. */
export function BetReceipt({ bet }: { bet: PlacedBet }) {
  return (
    <div className="space-y-3">
      <BetCardHeader bet={bet} />
      <BetSelectionsList bet={bet} />
      <BetCampaignNotes bet={bet} />
      <BetFooterSummary bet={bet} />
      <ShareBetButton bet={bet} />
      <BetReferenceFooter bet={bet} />
    </div>
  );
}
