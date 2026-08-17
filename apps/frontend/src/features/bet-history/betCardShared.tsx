import { useState, type ReactNode } from 'react';
import { CampaignRewardAlert } from '../../components/ui/CampaignRewardAlert';
import { MoneyBeforeAfter } from '../../components/ui/MoneyBeforeAfter';
import { ClockIcon, CopyIcon, FreebetBadgeIcon, ShareIcon } from '../../components/ui/NavIcons';
import { OddsBadge } from '../../components/ui/OddsBadge';
import { betStatusBadgeClasses, betStatusLabel, betStatusTextClasses } from '../../lib/betStatus';
import type { PlacedBet, PlacedBetSelection } from '../../lib/backendApi';
import { formatMoney } from '../../lib/currency';
import { displayedPayoutCents, uninsuredPayoutCents, unboostedCombinedOdds } from './betMoney';
import { shareBetImage } from './shareBetImage';
import { buildSharedBetUrl } from '../bet-slip/sharedBetLink';

export { displayedPayoutCents, uninsuredPayoutCents, unboostedCombinedOdds } from './betMoney';
export { formatMoney } from '../../lib/currency';

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
 * oddsVariant 'badge' is only for the full-screen "receipt" view (see
 * BetSelectionsList, used by WinCelebrationModal) - the highlight pill from
 * the bet-placed confirmation modal, reused there as a single bet's
 * headline price. Every other context (an accumulator leg, or a bet-history
 * card - see SelectionLegRow) stays 'plain'; the one combined-odds figure
 * gets the badge treatment instead (see BetFooterSummary).
 *
 * `dense` drops the bordered MatchInfoBox in favor of a single muted text
 * line - the boxed match-info row reads fine in the dedicated full-screen
 * receipt, but repeated once per leg inside an inline accumulator accordion
 * (see BetHistoryList's BetCard) it turned every leg into its own floating
 * mini-card, with no visual link between them. Dense rows are meant to sit
 * inside one shared bordered/divided container instead (see
 * SelectionLegList) so a bet history card reads as one connected list,
 * whether it's a single bet's lone selection or an accumulator's full leg
 * list.
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
 * One leg's row inside a bordered/divided list - dot, dense SelectionRow.
 * Used identically for every leg of an expanded accumulator (see
 * BetHistoryList's BetCard) and for a single (non-accumulator) bet's own
 * lone selection, so a single bet reads as visually identical to one leg of
 * an accumulator rather than getting its own separate treatment (badge
 * odds, boxed match info) the way it used to.
 */
export function SelectionLegRow({ selection }: { selection: PlacedBetSelection }) {
  return (
    <div className="flex items-start gap-2 p-2.5">
      <SelectionStatusDot status={selection.status} />
      <div className="min-w-0 flex-1">
        <SelectionRow selection={selection} dense />
      </div>
    </div>
  );
}

/** A bordered, internally-divided container of SelectionLegRows - one shared shape for a single bet's lone selection and an expanded accumulator's full leg list. */
export function SelectionLegList({ selections }: { selections: PlacedBetSelection[] }) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
      {selections.map((selection) => (
        <SelectionLegRow key={selection.id} selection={selection} />
      ))}
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
    { name: bet.registerCampaignName, rewardCents: bet.registerCampaignRewardCents },
  ].filter((note): note is { name: string; rewardCents: number | null } => note.name !== null);

  if (campaignNotes.length === 0 && bet.accaRollbackRewardCents === null) {
    return null;
  }
  return (
    <>
      {campaignNotes.map((note) => (
        <CampaignRewardAlert key={note.name} name={note.name} rewardCents={note.rewardCents} />
      ))}
      {bet.accaRollbackRewardCents !== null && (
        <p className="text-xs text-highlight">
          {formatMoney(bet.accaRollbackRewardCents)} refunded as a freebet (Acca Rollback)
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
      {/* Always shown, single or accumulator - the same gold OddsBadge pill
          either way, so a single's price reads with the same weight as an
          accumulator's combined odds rather than the plain text a leg row
          uses. */}
      <div className="flex items-center justify-between">
        <span className="text-text-secondary">{isAccumulator ? 'Combined odds' : 'Odds'}</span>
        <span className="flex items-center gap-1.5">
          {bet.accaBoostPercent > 0 && (
            <span className="text-xs text-text-secondary line-through decoration-1">
              {unboostedCombinedOdds(bet).toFixed(2)}
            </span>
          )}
          <OddsBadge className="px-1.5 py-0.5 text-xs">{Number(bet.combinedOdds).toFixed(2)}</OddsBadge>
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-text-secondary">Stake</span>
        <span className="flex items-center gap-1.5">
          {bet.fundedByFreebets && (
            <FreebetBadgeIcon width={15} height={15} className="shrink-0" role="img" aria-label="Funded by freebet" />
          )}
          {formatMoney(bet.stakeCents)}
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
              {formatMoney(bet.stakeCents)}
            </span>
          ) : showInsuranceBeforeAfter ? (
            <MoneyBeforeAfter beforeCents={uninsuredPayoutCents(bet)} afterCents={payoutCents} />
          ) : (
            formatMoney(payoutCents)
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
    return `My ${bet.selections.length}-selection accumulator ${outcome} - stake ${formatMoney(bet.stakeCents)}, combined odds ${Number(bet.combinedOdds).toFixed(2)}${bet.status === 'WON' ? `, payout ${formatMoney(payoutCents)}` : ''}.`;
  }
  const selection = bet.selections[0]!;
  return `My bet on ${selection.selectionName} (${selection.marketName}) ${outcome} - stake ${formatMoney(bet.stakeCents)} at odds ${Number(selection.odds).toFixed(2)}${bet.status === 'WON' ? `, payout ${formatMoney(payoutCents)}` : ''}.`;
}

/**
 * Settled-bet-only share action - renders the bet as an image (see
 * shareBetImage.ts) and shares that via the Web Share API's file support,
 * falling back to downloading the PNG when the browser can't share files
 * directly (most desktop browsers), and to the old text-only Web
 * Share/clipboard flow if image generation itself fails for any reason
 * (defensive - canvas support is effectively universal, but never worth a
 * broken Share button over). Omitted for a still-PENDING bet, matching the
 * reference (which shows Cashout, not Share, for an open bet - we have
 * neither a real cashout feature to build, so that slot is simply empty for
 * an open bet).
 */
export function ShareBetButton({ bet }: { bet: PlacedBet }) {
  const [feedback, setFeedback] = useState<string | null>(null);

  if (bet.status === 'PENDING') {
    return null;
  }

  async function shareAsText() {
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

  async function handleShare() {
    try {
      const result = await shareBetImage(bet, shareTextForBet(bet));
      if (result === 'downloaded') {
        setFeedback('Image saved - share it from your downloads');
      }
    } catch {
      await shareAsText();
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

/**
 * Open (PENDING)-bet-only share/copy pair - deliberately different from
 * ShareBetButton's settled-bet image share: a still-open bet is something a
 * player might want another player to *copy*, not just see, so both actions
 * carry the deep link built by sharedBetLink.ts (see SharedBetPage, which
 * resolves it against live odds and adds the same selections to the
 * visiting player's own slip) rather than a plain description. Share still
 * renders the same receipt image as a settled bet, with the link appended
 * to its share text; Copy just puts the link on the clipboard - no image
 * involved, since the point there is a pasteable link, not something to
 * post.
 */
export function SharePendingBetActions({ bet }: { bet: PlacedBet }) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const url = buildSharedBetUrl(bet.selections);
  const text = `${
    bet.selections.length > 1
      ? `My ${bet.selections.length}-selection accumulator - stake ${formatMoney(bet.stakeCents)}, combined odds ${Number(bet.combinedOdds).toFixed(2)}.`
      : `My bet on ${bet.selections[0]!.selectionName} (${bet.selections[0]!.marketName}) - stake ${formatMoney(bet.stakeCents)} at odds ${Number(bet.selections[0]!.odds).toFixed(2)}.`
  } Copy my bet: ${url}`;

  async function shareAsText() {
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

  async function handleShare() {
    try {
      const result = await shareBetImage(bet, text);
      if (result === 'downloaded') {
        setFeedback('Image saved - share it from your downloads');
      }
    } catch {
      await shareAsText();
    }
  }

  async function handleCopy() {
    if (!navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setFeedback('Link copied to clipboard');
    } catch {
      // Best-effort only.
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void handleShare()}
          className="btn-ghost flex flex-1 items-center justify-center gap-2"
        >
          <ShareIcon width={16} height={16} />
          Share
        </button>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="btn-ghost flex flex-1 items-center justify-center gap-2"
        >
          <CopyIcon width={16} height={16} />
          Copy
        </button>
      </div>
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

/** The full bet "receipt" - header, every selection, campaign/rollback notes, footer summary, share, ref/date. Used by step 2 of WinCelebrationModal. */
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
