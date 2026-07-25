import type { BetAndGetCampaign } from '../../lib/backendApi';
import { Card } from '../../components/ui/Card';
import { formatCampaignRequirements } from './formatCampaignRequirements';

interface CampaignContextBannerProps {
  campaign: BetAndGetCampaign;
}

/**
 * Player-facing context for a Bet & Get campaign - shown at the top of the
 * campaign-matches page and, per-match, on MatchDetailPage when the match
 * qualifies for an active campaign. Deliberately shows only the campaign's
 * own name, the staff-authored description (never a canned marketing
 * sentence generated from the reward/trigger config), and the auto-derived
 * qualification requirements - never the matches themselves, which is
 * whatever page renders below it.
 */
export function CampaignContextBanner({ campaign }: CampaignContextBannerProps) {
  const requirements = formatCampaignRequirements(campaign);

  return (
    <Card className="border-highlight/40 bg-surface-2">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-highlight px-2.5 py-1 text-[10px] font-extrabold tracking-widest text-slate-950 uppercase">
          Bet &amp; Get
        </span>
        <h2 className="font-display text-base">{campaign.name}</h2>
      </div>
      {campaign.description && <p className="mt-1.5 text-sm text-text-secondary">{campaign.description}</p>}
      {requirements.length > 0 && (
        <p className="mt-1.5 text-xs text-text-secondary">{requirements.join(' · ')}</p>
      )}
    </Card>
  );
}
