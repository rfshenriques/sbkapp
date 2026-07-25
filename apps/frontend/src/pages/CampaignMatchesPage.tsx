import { useMemo } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { BackButton } from '../components/ui/BackButton';
import { Card } from '../components/ui/Card';
import { CampaignContextBanner } from '../features/bet-and-get/CampaignContextBanner';
import { useCampaignMatches } from '../features/bet-and-get/useCampaignMatches';
import { useBetAndGetCampaigns } from '../features/bet-and-get/useBetAndGetCampaigns';
import { GroupedMatchList } from '../features/odds-board/GroupedMatchList';
import { MatchListSkeleton } from '../features/odds-board/MatchListSkeleton';
import { groupMatchesBySportAndCompetition } from '../lib/groupMatchesBySportAndCompetition';

/**
 * What a Bet & Get campaign's promo card/link resolves to when its scope
 * covers more than one match - grouped by sport then competition, same
 * shape as SpecialsPage's per-sport grouping one level deeper. A campaign
 * scoped to exactly one match never renders this - see
 * resolveCampaignLinkPath, used wherever a campaign link is generated.
 */
export default function CampaignMatchesPage() {
  const { campaignId } = useParams();
  const { data: matches, isPending: matchesPending, isError: matchesError } = useCampaignMatches(campaignId);
  const { data: campaigns } = useBetAndGetCampaigns();

  const campaign = campaigns?.find((entry) => entry.id === campaignId);
  const groups = useMemo(() => groupMatchesBySportAndCompetition(matches ?? []), [matches]);

  if (!matchesPending && matches && matches.length === 1) {
    return <Navigate to={`/matches/${matches[0]!.id}`} replace />;
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <BackButton className="-ml-1.5" />
        <span className="brand-flag" aria-hidden="true">
          <i></i>
          <i></i>
          <i></i>
        </span>
        <h1 className="font-display text-lg">{campaign?.name ?? 'Bet & Get'}</h1>
      </div>

      {campaign && (
        <div className="mb-6">
          <CampaignContextBanner campaign={campaign} />
        </div>
      )}

      {matchesPending && <MatchListSkeleton />}
      {matchesError && <Card className="text-danger">Failed to load this campaign's matches.</Card>}
      {groups.length === 0 && !matchesPending && !matchesError && (
        <Card className="text-text-secondary">No matches currently qualify for this campaign.</Card>
      )}

      <GroupedMatchList groups={groups} />
    </div>
  );
}
