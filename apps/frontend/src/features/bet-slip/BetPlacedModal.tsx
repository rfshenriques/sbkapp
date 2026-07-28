import { useEffect, useState } from 'react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { CampaignRewardAlert } from '../../components/ui/CampaignRewardAlert';
import { ChevronIcon } from '../../components/ui/ChevronIcon';
import { ShareIcon } from '../../components/ui/NavIcons';
import { OddsBadge } from '../../components/ui/OddsBadge';
import { cn } from '../../lib/cn';
import { BetFooterSummary, BetReferenceFooter, BetSelectionsList, SharePendingBetActions } from '../bet-history/betCardShared';
import { useBetPlacedModalStore } from './betPlacedModalStore';

function formatEuros(cents: number): string {
  return `${(cents / 100).toFixed(2)} €`;
}

/**
 * Fires immediately after a successful placement (see BetSlipPanel's two
 * mutation onSuccess handlers) - a confirmation moment distinct from
 * WinCelebrationModal, which only fires later once the bet actually
 * settles. Reference-inspired layout: a big success badge, the potential
 * payout, then a stake/odds summary row.
 */
export function BetPlacedModal() {
  const summary = useBetPlacedModalStore((state) => state.summary);
  const close = useBetPlacedModalStore((state) => state.close);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  useEffect(() => {
    if (summary) {
      setShareFeedback(null);
      setDetailsExpanded(false);
    }
  }, [summary]);

  if (!summary) {
    return null;
  }

  const {
    stakeCents,
    potentialPayoutCents,
    combinedOdds,
    betCount,
    betAndGetCampaignName,
    betAndGetCampaignRewardCents,
    depositCampaignName,
    depositCampaignRewardCents,
    bet,
  } = summary;
  const campaignNotes = [
    { name: betAndGetCampaignName, rewardCents: betAndGetCampaignRewardCents },
    { name: depositCampaignName, rewardCents: depositCampaignRewardCents },
  ].filter((note): note is { name: string; rewardCents: number | null } => note.name !== null);

  // Only a multi-singles placement (several independent bets from one
  // button, see BetSlipPanel's placeSinglesMutation) has no single `bet` to
  // share/expand - there's no one receipt to show for several bets at once,
  // so that case keeps the old plain-text share and has no details section.
  async function handleShare() {
    const text =
      combinedOdds !== null
        ? `I just placed a bet! Stake ${formatEuros(stakeCents)} at odds ${combinedOdds.toFixed(2)} - potential payout ${formatEuros(potentialPayoutCents)}.`
        : `I just placed ${betCount} bets! Total stake ${formatEuros(stakeCents)} - total potential payout ${formatEuros(potentialPayoutCents)}.`;

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
        setShareFeedback('Copied to clipboard');
      } catch {
        // Best-effort only.
      }
    }
  }

  return (
    <BottomSheet
      title="Bet placed"
      icon={
        <span
          aria-hidden="true"
          className="flex h-6 w-6 items-center justify-center rounded-full bg-price-up text-xs font-bold text-black"
        >
          ✓
        </span>
      }
      onClose={close}
      closeLabel="Close bet placed confirmation"
      footer={
        <>
          {bet ? (
            <SharePendingBetActions bet={bet} />
          ) : (
            <>
              <button
                type="button"
                onClick={() => void handleShare()}
                className="btn-primary flex w-full items-center justify-center gap-2"
              >
                <ShareIcon width={16} height={16} />
                Share
              </button>
              {shareFeedback && <p className="mt-2 text-center text-xs text-text-secondary">{shareFeedback}</p>}
            </>
          )}
          <button type="button" onClick={close} className="mt-2 w-full text-center text-sm text-text-secondary hover:underline">
            Bet again
          </button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <span
          aria-hidden="true"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-price-up text-3xl font-bold text-black"
        >
          ✓
        </span>
        <p className="font-display text-2xl">Done! Your bet has been placed.</p>
        <p className="text-sm text-text-secondary">Potential payout</p>
        <p className="font-display text-5xl leading-none">{formatEuros(potentialPayoutCents)}</p>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <div>
          <p className="text-xs text-text-secondary">Stake</p>
          <p className="mt-1 font-display text-lg">{formatEuros(stakeCents)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-text-secondary">{combinedOdds !== null ? 'Odds' : 'Bets placed'}</p>
          <div className="mt-1">
            {combinedOdds !== null ? (
              <OddsBadge className="px-2 py-0.5 text-lg">{combinedOdds.toFixed(2)}</OddsBadge>
            ) : (
              <p className="font-display text-lg">{betCount}</p>
            )}
          </div>
        </div>
      </div>

      {campaignNotes.length > 0 && (
        <div className="space-y-1.5 border-t border-border pt-4">
          {campaignNotes.map((note) => (
            <CampaignRewardAlert key={note.name} name={note.name} rewardCents={note.rewardCents} />
          ))}
        </div>
      )}

      {bet && (
        <div className="border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setDetailsExpanded((expanded) => !expanded)}
            aria-expanded={detailsExpanded}
            className="flex w-full items-center justify-between gap-2 text-sm font-semibold text-text-secondary"
          >
            Bet details
            <ChevronIcon width={14} height={14} className={detailsExpanded ? 'rotate-180' : ''} />
          </button>
          <div
            className={cn(
              'grid transition-[grid-template-rows] duration-300 ease-out',
              detailsExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
            )}
          >
            <div className="overflow-hidden">
              <div className="space-y-3 pt-3">
                <BetSelectionsList bet={bet} />
                <BetFooterSummary bet={bet} />
                <BetReferenceFooter bet={bet} />
              </div>
            </div>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
