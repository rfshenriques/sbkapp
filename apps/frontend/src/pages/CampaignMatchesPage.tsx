import { useMemo } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import type { Match } from '@sportsbook/shared';
import { BackButton } from '../components/ui/BackButton';
import { Card } from '../components/ui/Card';
import { SportCountryBadge } from '../components/ui/SportCountryBadge';
import { SportIcon } from '../components/ui/SportIcon';
import { CampaignContextBanner } from '../features/bet-and-get/CampaignContextBanner';
import { useCampaignMatches } from '../features/bet-and-get/useCampaignMatches';
import { useBetAndGetCampaigns } from '../features/bet-and-get/useBetAndGetCampaigns';
import { useDisplayNames } from '../features/display-names/useDisplayNames';
import { MatchListSkeleton } from '../features/odds-board/MatchListSkeleton';
import { formatKickoff } from '../lib/formatKickoff';

interface CompetitionGroup {
  competition: string;
  matches: Match[];
}
interface SportGroup {
  sport: string;
  competitions: CompetitionGroup[];
}

function groupBySportAndCompetition(matches: Match[]): SportGroup[] {
  const sportMap = new Map<string, Map<string, Match[]>>();
  for (const match of matches) {
    const competitionMap = sportMap.get(match.sport) ?? new Map<string, Match[]>();
    sportMap.set(match.sport, competitionMap);
    const competitionMatches = competitionMap.get(match.competition) ?? [];
    competitionMatches.push(match);
    competitionMap.set(match.competition, competitionMatches);
  }
  return Array.from(sportMap.entries()).map(([sport, competitionMap]) => ({
    sport,
    competitions: Array.from(competitionMap.entries()).map(([competition, competitionMatches]) => ({
      competition,
      matches: competitionMatches,
    })),
  }));
}

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
  const displayName = useDisplayNames();

  const campaign = campaigns?.find((entry) => entry.id === campaignId);
  const groups = useMemo(() => groupBySportAndCompetition(matches ?? []), [matches]);

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

      <div className="space-y-6">
        {groups.map((group) => (
          <div key={group.sport}>
            <div className="mb-2 flex items-center gap-2">
              <SportIcon sport={group.sport} size={22} />
              <h2 className="font-display text-base">{displayName('SPORT', group.sport)}</h2>
            </div>
            <div className="space-y-4">
              {group.competitions.map((competitionGroup) => (
                <div key={competitionGroup.competition}>
                  <p className="mb-1.5 text-xs font-semibold text-text-secondary">
                    {displayName('COMPETITION', competitionGroup.competition)}
                  </p>
                  <div className="space-y-2">
                    {competitionGroup.matches.map((match) => {
                      const homeTeamLabel = displayName('TEAM', match.homeTeam);
                      const awayTeamLabel = displayName('TEAM', match.awayTeam);
                      return (
                        <Link key={match.id} to={`/matches/${match.id}`}>
                          <Card className="bg-surface-2">
                            <div className="mb-1 flex min-w-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                              <SportCountryBadge sport={match.sport} country={match.country} />
                              <span className="ml-auto shrink-0 text-highlight">
                                {formatKickoff(new Date(match.kickoff))}
                              </span>
                            </div>
                            <p className="font-semibold">
                              {homeTeamLabel} <span className="text-text-muted">vs</span> {awayTeamLabel}
                            </p>
                          </Card>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
