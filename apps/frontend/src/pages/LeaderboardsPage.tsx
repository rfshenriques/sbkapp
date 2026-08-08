import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { TrophyIcon } from '../components/ui/NavIcons';
import { Skeleton } from '../components/ui/Skeleton';
import { formatLeaderboardPointsRule } from '../features/leaderboards/formatLeaderboardPointsRule';
import { useLeaderboardCampaigns } from '../features/leaderboards/useLeaderboardCampaigns';

function formatEndsAt(endAt: string): string {
  const date = new Date(endAt);
  return `Ends ${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
}

/** Every currently-running, enabled leaderboard for the brand - opt-in point competitions, ranked automatically from qualifying bets. See LeaderboardDetailPage for the ranked entries. */
export default function LeaderboardsPage() {
  const { data: campaigns, isPending } = useLeaderboardCampaigns();
  const hasCampaigns = Boolean(campaigns && campaigns.length > 0);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <TrophyIcon width={22} height={22} />
        <h1 className="font-display text-lg">Leaderboards</h1>
      </div>

      {isPending ? (
        <div className="space-y-3" aria-label="Loading leaderboards" role="status">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : hasCampaigns ? (
        <div className="space-y-3">
          {campaigns!.map((campaign) => (
            <Link key={campaign.id} to={`/leaderboards/${campaign.id}`}>
              <Card className="transition hover:border-highlight/50">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-highlight px-2.5 py-1 text-[10px] font-extrabold tracking-widest text-slate-950 uppercase">
                    Leaderboard
                  </span>
                  <span className="text-xs text-text-secondary">{formatEndsAt(campaign.endAt)}</span>
                </div>
                <h2 className="mt-2 font-display text-base">{campaign.name}</h2>
                {campaign.description && (
                  <p className="mt-1 text-sm text-text-secondary">{campaign.description}</p>
                )}
                <p className="mt-1.5 text-xs text-text-secondary">{formatLeaderboardPointsRule(campaign)}</p>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="text-text-secondary">No leaderboards running right now - check back soon.</Card>
      )}
    </div>
  );
}
