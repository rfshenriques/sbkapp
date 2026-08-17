import { useParams } from 'react-router-dom';
import { BackButton } from '../components/ui/BackButton';
import { Card } from '../components/ui/Card';
import { TrophyIcon } from '../components/ui/NavIcons';
import { Skeleton } from '../components/ui/Skeleton';
import { formatMoney } from '../lib/currency';
import { JoinLeaderboardButton } from '../features/leaderboards/JoinLeaderboardButton';
import { LeaderboardContextBanner } from '../features/leaderboards/LeaderboardContextBanner';
import { LeaderboardEntryRow } from '../features/leaderboards/LeaderboardEntryRow';
import { useLeaderboardCampaign } from '../features/leaderboards/useLeaderboardCampaign';
import { useLeaderboardEntries } from '../features/leaderboards/useLeaderboardEntries';

/** One leaderboard's own page - context, a Participate button, its prize tiers (if any), and the live ranked list. */
export default function LeaderboardDetailPage() {
  const { campaignId } = useParams();
  const { data: campaign, isPending: campaignPending, isError: campaignError } = useLeaderboardCampaign(campaignId);
  const { data: entries, isPending: entriesPending, isError: entriesError } = useLeaderboardEntries(campaignId);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <BackButton className="-ml-1.5" />
        <TrophyIcon width={22} height={22} />
        <h1 className="font-display text-lg">{campaign?.name ?? 'Leaderboard'}</h1>
      </div>

      {campaignPending && (
        <div className="space-y-3" aria-label="Loading leaderboard" role="status">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      )}
      {campaignError && <Card className="text-danger">Failed to load this leaderboard.</Card>}

      {campaign && (
        <div className="space-y-4">
          <LeaderboardContextBanner campaign={campaign} />

          {campaignId && <JoinLeaderboardButton campaignId={campaignId} />}

          {campaign.rewardTiers.length > 0 && (
            <Card>
              <h2 className="font-display text-sm">Prizes</h2>
              <div className="mt-2 space-y-1.5">
                {[...campaign.rewardTiers]
                  .sort((a, b) => a.rankFrom - b.rankFrom)
                  .map((tier) => (
                    <div key={tier.id} className="flex items-center justify-between text-sm">
                      <span className="text-text-secondary">
                        {tier.rankFrom === tier.rankTo ? `Rank ${tier.rankFrom}` : `Ranks ${tier.rankFrom}–${tier.rankTo}`}
                      </span>
                      <span className="font-semibold text-highlight">{formatMoney(tier.rewardAmountCents)} freebet</span>
                    </div>
                  ))}
              </div>
            </Card>
          )}

          <div>
            <h2 className="mb-2 font-display text-sm">Ranking</h2>
            {entriesPending && (
              <div className="space-y-1.5" aria-label="Loading ranking" role="status">
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-11 w-full" />
              </div>
            )}
            {entriesError && <Card className="text-danger">Failed to load the ranking.</Card>}
            {entries && entries.length === 0 && (
              <Card className="text-text-secondary">No one has joined yet - be the first.</Card>
            )}
            {entries && entries.length > 0 && (
              <div className="space-y-1">
                {entries.map((entry) => (
                  <LeaderboardEntryRow key={entry.entryId} entry={entry} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
