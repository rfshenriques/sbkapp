import { formatMoney } from '../../lib/currency';
import { FreebetBadgeIcon } from './NavIcons';

interface CampaignRewardAlertProps {
  name: string;
  rewardCents: number | null;
}

/**
 * Gold "campaign reward" alert - shared by the bet slip's live qualification
 * preview, the bet-placed confirmation modal, and bet history's settled
 * campaign note, so a Bet & Get/deposit campaign reward reads identically
 * everywhere it's mentioned. --color-highlight, not a fixed hex - brand
 * theming already treats highlight as the app's general accent (see
 * index.css), and this is the same "reward" meaning as the odds/badge pills
 * that already use it elsewhere.
 *
 * Two deliberate rows, not one flex-wrap line left to break on its own - on
 * a narrower card (bet history) the full sentence wrapped mid-phrase in an
 * ugly spot. Splitting the campaign name from the reward amount gives every
 * context the same clean two-line shape instead of an unpredictable wrap.
 */
export function CampaignRewardAlert({ name, rewardCents }: CampaignRewardAlertProps) {
  return (
    <div className="rounded-xl border border-highlight/40 bg-highlight/10 p-2.5 text-highlight">
      <p className="text-xs font-semibold">🎁 Qualifies for {name}</p>
      {rewardCents !== null && (
        <p className="mt-0.5 flex items-center gap-1 text-sm font-bold">
          <FreebetBadgeIcon width={16} height={16} className="shrink-0" />
          <span>{formatMoney(rewardCents)} in Freebets</span>
        </p>
      )}
    </div>
  );
}
