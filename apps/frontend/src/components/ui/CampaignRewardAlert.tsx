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
 */
export function CampaignRewardAlert({ name, rewardCents }: CampaignRewardAlertProps) {
  return (
    <p className="flex flex-wrap items-center gap-1 rounded-xl border border-highlight/40 bg-highlight/10 p-2.5 text-xs font-semibold text-highlight">
      <span>🎁 Qualifies for {name} to get</span>
      {rewardCents !== null && (
        <>
          <FreebetBadgeIcon width={14} height={14} className="shrink-0" />
          <span>{(rewardCents / 100).toFixed(2)} € in Freebets</span>
        </>
      )}
    </p>
  );
}
