import { useParams } from 'react-router-dom';
import { BackButton } from '../components/ui/BackButton';
import { Breadcrumb, type BreadcrumbSegment } from '../components/ui/Breadcrumb';
import { Skeleton } from '../components/ui/Skeleton';
import { SportCountryBadge } from '../components/ui/SportCountryBadge';
import { TeamColorAccent } from '../components/ui/TeamColorAccent';
import { MarketSelections } from '../features/bet-slip/MarketSelections';
import { useDisplayNames } from '../features/display-names/useDisplayNames';
import { LiveMatchTracker } from '../features/match-detail/LiveMatchTracker';
import { useLiveMatch } from '../features/match-detail/useLiveMatch';
import { useMatch } from '../features/match-detail/useMatch';
import { useMatches } from '../features/odds-board/useMatches';
import { useTeamColors } from '../features/odds-board/useTeamColors';
import { formatKickoff } from '../lib/formatKickoff';
import type { Match } from '@sportsbook/shared';

/** Same rule MatchCard uses: no kickoff shown for a match already live. */
function kickoffMeta(candidate: Match) {
  return candidate.isLive ? undefined : formatKickoff(new Date(candidate.kickoff));
}

export default function MatchDetailPage() {
  const { matchId } = useParams();
  const { data: match, isPending, isError } = useMatch(matchId);
  const { data: liveState } = useLiveMatch(matchId, match?.isLive ?? false);
  const { data: allMatches } = useMatches();
  const displayName = useDisplayNames();
  const teamColors = useTeamColors();

  if (isPending) {
    return (
      <div className="space-y-3" aria-label="Loading match" role="status">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (isError || !match) {
    return <p className="text-danger">Match not found.</p>;
  }

  const matchResult = match.markets.find((market) => market.id === 'match-result');
  const homeTeamLabel = displayName('TEAM', match.homeTeam);
  const awayTeamLabel = displayName('TEAM', match.awayTeam);
  const matchLabel = `${homeTeamLabel} vs ${awayTeamLabel}`;
  const kickoff = new Date(match.kickoff);

  const competitionsInCountry = [
    ...new Set(
      (allMatches ?? [])
        .filter((candidate) => candidate.sport === match.sport && candidate.country === match.country)
        .map((candidate) => candidate.competition),
    ),
  ];
  const siblingMatches = (allMatches ?? []).filter((candidate) => candidate.competition === match.competition);

  const breadcrumbSegments: BreadcrumbSegment[] = [
    { key: 'home', label: 'Home', href: '/' },
    {
      key: 'sport',
      label: displayName('SPORT', match.sport),
      href: `/sports/${encodeURIComponent(match.sport)}`,
    },
    {
      key: 'competition',
      label: displayName('COMPETITION', match.competition),
      href: `/sports/${encodeURIComponent(match.sport)}?competition=${encodeURIComponent(match.competition)}`,
      options: competitionsInCountry.map((competition) => ({
        key: competition,
        label: displayName('COMPETITION', competition),
        href: `/sports/${encodeURIComponent(match.sport)}?competition=${encodeURIComponent(competition)}`,
      })),
    },
    {
      key: 'match',
      label: matchLabel,
      options: siblingMatches.map((sibling) => ({
        key: sibling.id,
        label: `${displayName('TEAM', sibling.homeTeam)} vs ${displayName('TEAM', sibling.awayTeam)}`,
        href: `/matches/${sibling.id}`,
        meta: kickoffMeta(sibling),
      })),
    },
  ];

  return (
    <div>
      <Breadcrumb
        segments={breadcrumbSegments}
        icon={
          <>
            <BackButton className="-ml-1.5 shrink-0" />
            <SportCountryBadge sport={match.sport} country={match.country} size={20} />
          </>
        }
      />

      <section className="relative mt-2 overflow-hidden rounded-3xl border border-border bg-surface p-6">
        {match.isLive ? (
          <span className="absolute top-4 right-4 rounded-full bg-price-down px-2.5 py-1 text-[10px] font-extrabold tracking-widest text-white uppercase">
            Live
          </span>
        ) : (
          <p className="text-center text-sm font-semibold text-text-secondary">{formatKickoff(kickoff)}</p>
        )}
        <h1
          aria-label={matchLabel}
          className="mt-3 flex items-center gap-2 font-display text-lg leading-tight sm:text-2xl"
        >
          <TeamColorAccent colorHex={teamColors.get(match.homeTeam)} className="h-4 shrink-0 sm:h-6" />
          <span className="min-w-0 truncate">{homeTeamLabel}</span>
          <span className="shrink-0 text-sm font-normal text-text-muted normal-case sm:text-base">vs</span>
          <span className="min-w-0 truncate">{awayTeamLabel}</span>
          <TeamColorAccent colorHex={teamColors.get(match.awayTeam)} className="h-4 shrink-0 sm:h-6" />
        </h1>
      </section>

      {match.isLive && liveState && (
        <div className="mt-6">
          <LiveMatchTracker state={liveState} homeTeam={homeTeamLabel} awayTeam={awayTeamLabel} />
        </div>
      )}

      {matchResult ? (
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <span className="brand-flag" aria-hidden="true">
              <i></i>
              <i></i>
              <i></i>
            </span>
            <h2 className="font-display text-lg">{displayName('MARKET', matchResult.name)}</h2>
          </div>
          <MarketSelections matchId={match.id} matchLabel={matchLabel} market={matchResult} />
        </div>
      ) : (
        <p className="mt-6 text-text-secondary">No odds available for this match yet.</p>
      )}
    </div>
  );
}
