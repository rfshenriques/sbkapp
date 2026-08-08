import { Card } from '../../components/ui/Card';
import type { LeaderboardCampaign } from '../../lib/backendApi';
import { formatCampaignRequirements } from '../bet-and-get/formatCampaignRequirements';
import { formatLeaderboardPointsRule } from './formatLeaderboardPointsRule';

interface LeaderboardContextBannerProps {
  campaign: LeaderboardCampaign & {
    /** Set only by useLeaderboardsForMatch - true when this match is in scope but doesn't satisfy the bettingTiming requirement. */
    timingBlocked?: boolean;
  };
}

/**
 * Player-facing context for a leaderboard - shown at the top of the
 * leaderboard detail page and, per-match, on MatchDetailPage when the match
 * qualifies for a running leaderboard. Same shape as CampaignContextBanner:
 * own name, staff-authored description, auto-derived qualifying conditions
 * and points rule - never a fabricated marketing sentence.
 */
export function LeaderboardContextBanner({ campaign }: LeaderboardContextBannerProps) {
  const requirements = formatCampaignRequirements(campaign);

  return (
    <Card className={campaign.timingBlocked ? 'border-danger/40 bg-surface-2' : 'border-highlight/40 bg-surface-2'}>
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-highlight px-2.5 py-1 text-[10px] font-extrabold tracking-widest text-slate-950 uppercase">
          Leaderboard
        </span>
        <h2 className="font-display text-base">{campaign.name}</h2>
      </div>
      {campaign.description && <p className="mt-1.5 text-sm text-text-secondary">{campaign.description}</p>}
      <p className="mt-1.5 text-xs text-text-secondary">{formatLeaderboardPointsRule(campaign)}</p>
      {requirements.length > 0 && (
        <p className="mt-1.5 text-xs text-text-secondary">{requirements.join(' · ')}</p>
      )}
      {campaign.timingBlocked && (
        <p className="mt-1.5 text-xs font-semibold text-danger">
          {campaign.bettingTiming === 'PREMATCH_ONLY'
            ? 'This match no longer qualifies - only prematch bets earn points here.'
            : 'This match doesn’t qualify yet - only in-play bets earn points here.'}
        </p>
      )}
    </Card>
  );
}
