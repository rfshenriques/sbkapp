import { useParams } from 'react-router-dom';
import { BackButton } from '../components/ui/BackButton';
import { Breadcrumb, type BreadcrumbSegment } from '../components/ui/Breadcrumb';
import { Skeleton } from '../components/ui/Skeleton';
import { SportCountryBadge } from '../components/ui/SportCountryBadge';
import { MarketSelections } from '../features/bet-slip/MarketSelections';
import { useDisplayNames } from '../features/display-names/useDisplayNames';
import { LiveMatchTracker } from '../features/match-detail/LiveMatchTracker';
import { useLiveMatch } from '../features/match-detail/useLiveMatch';
import { useMatch } from '../features/match-detail/useMatch';
import { useMatches } from '../features/odds-board/useMatches';

export default function MatchDetailPage() {
  const { matchId } = useParams();
  const { data: match, isPending, isError } = useMatch(matchId);
  const { data: liveState } = useLiveMatch(matchId, match?.isLive ?? false);
  const { data: allMatches } = useMatches();
  const displayName = useDisplayNames();

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
      })),
    },
  ];

  return (
    <div>
      <div className="flex min-w-0 items-center gap-2">
        <BackButton className="-ml-1.5 shrink-0" />
        <Breadcrumb
          segments={breadcrumbSegments}
          icon={<SportCountryBadge sport={match.sport} country={match.country} size={20} />}
        />
      </div>

      <section className="relative mt-2 overflow-hidden rounded-2xl border border-border bg-surface p-6">
        <span
          className={`slash mb-2 inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest ${
            match.isLive ? 'bg-price-down text-white' : 'bg-highlight text-black'
          }`}
        >
          {match.isLive ? 'Live' : 'Pre-match'}
        </span>
        <h1 className="font-display text-2xl leading-none sm:text-3xl">{matchLabel}</h1>
        {!match.isLive && (
          <p className="mt-2 text-sm text-text-secondary">
            {kickoff.toLocaleString(undefined, {
              weekday: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}
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
            <h2 className="font-display text-lg">{matchResult.name}</h2>
          </div>
          <MarketSelections matchId={match.id} matchLabel={matchLabel} market={matchResult} />
        </div>
      ) : (
        <p className="mt-6 text-text-secondary">No odds available for this match yet.</p>
      )}
    </div>
  );
}
