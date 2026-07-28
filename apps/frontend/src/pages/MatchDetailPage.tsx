import { useParams } from 'react-router-dom';
import { BackButton } from '../components/ui/BackButton';
import { Breadcrumb, type BreadcrumbSegment } from '../components/ui/Breadcrumb';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { SportCountryBadge } from '../components/ui/SportCountryBadge';
import { TeamColorAccent } from '../components/ui/TeamColorAccent';
import { CampaignContextBanner } from '../features/bet-and-get/CampaignContextBanner';
import { useCampaignsForMatch } from '../features/bet-and-get/useCampaignsForMatch';
import { BoostedOddsRow } from '../features/bet-slip/BoostedOddsRow';
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

/**
 * A stand-in accent color for the header's team badges when no admin has
 * assigned that team a real one yet (see Team Colors backoffice) - without
 * this, the two-color layout only ever appeared for the handful of teams
 * someone had gotten around to coloring, and looked broken everywhere
 * else. Deterministic per team name (same team always gets the same
 * color), picked from a fixed brand-neutral palette rather than anything
 * resembling a real club color.
 */
const FALLBACK_TEAM_COLORS = [
  '#F87171',
  '#FB923C',
  '#FBBF24',
  '#4ADE80',
  '#2DD4BF',
  '#38BDF8',
  '#818CF8',
  '#C084FC',
  '#F472B6',
];

function fallbackTeamColor(name: string): string {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  }
  return FALLBACK_TEAM_COLORS[hash % FALLBACK_TEAM_COLORS.length]!;
}

export default function MatchDetailPage() {
  const { matchId } = useParams();
  const { data: match, isPending, isError } = useMatch(matchId);
  const { data: liveState } = useLiveMatch(matchId, match?.isLive ?? false);
  const { data: allMatches } = useMatches();
  const { data: applicableCampaigns } = useCampaignsForMatch(match?.id);
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
  // Manual (trader-created) markets stack together under one "Specials"
  // heading rather than getting their own section each, per the same rule
  // as SpecialsPage - the rest keep their own section below Match Result.
  const otherMarkets = match.markets.filter((market) => market.id !== 'match-result' && !market.isSpecial);
  const specialMarkets = match.markets.filter((market) => market.id !== 'match-result' && market.isSpecial);
  // originalOdds is only ever set when a boost actually changed the price
  // (see BoostService.applyBoosts) - flattened here the same way the
  // Boosts page flattens BoostedSelectionSummary, so this match's boosted
  // prices get their own section above everything else, per the same rule.
  const boostedSelections = match.markets.flatMap((market) =>
    market.selections
      .filter((selection) => selection.originalOdds !== undefined)
      .map((selection) => ({ market, selection })),
  );
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
          className="mt-3 flex items-center justify-center gap-2 font-display text-lg leading-tight sm:text-2xl"
        >
          <TeamColorAccent
            colorHex={teamColors.get(match.homeTeam) ?? fallbackTeamColor(match.homeTeam)}
            className="h-4 shrink-0 sm:h-6"
          />
          <span className="min-w-0 truncate">{homeTeamLabel}</span>
          {match.isLive && liveState ? (
            <span className="shrink-0 tabular-nums">
              {liveState.homeScore} - {liveState.awayScore}
            </span>
          ) : (
            <span className="shrink-0 text-sm font-normal text-text-muted normal-case sm:text-base">vs</span>
          )}
          <span className="min-w-0 truncate">{awayTeamLabel}</span>
          <TeamColorAccent
            colorHex={teamColors.get(match.awayTeam) ?? fallbackTeamColor(match.awayTeam)}
            className="h-4 shrink-0 sm:h-6"
          />
        </h1>

        {/* Result lives in this same header block (not a separate card
            below), and momentum sits right under it in the same block too -
            these three (team names, score, pressure) read as one connected
            state of the match rather than three disconnected cards. */}
        {match.isLive && liveState && (
          <div className="mt-3">
            <p className="text-center font-display text-sm text-highlight">{liveState.minute}'</p>
            <div className="mt-3">
              <div className="mb-1.5 flex justify-between gap-2 text-[11px] font-semibold text-text-secondary">
                <span className="min-w-0 truncate">{homeTeamLabel} pressure</span>
                <span className="min-w-0 truncate">{awayTeamLabel} pressure</span>
              </div>
              <div className="momentum-bar" role="img" aria-label="Match momentum">
                <span
                  className="side home"
                  style={{ flexBasis: `${liveState.momentum.home}%` }}
                  aria-hidden="true"
                />
                <span
                  className="side away"
                  style={{ flexBasis: `${liveState.momentum.away}%` }}
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {applicableCampaigns && applicableCampaigns.length > 0 && (
        <div className="mt-6 space-y-3">
          {applicableCampaigns.map((campaign) => (
            <CampaignContextBanner key={campaign.id} campaign={campaign} />
          ))}
        </div>
      )}

      {match.isLive && liveState && (
        <div className="mt-6">
          <LiveMatchTracker state={liveState} homeTeam={homeTeamLabel} awayTeam={awayTeamLabel} />
        </div>
      )}

      {boostedSelections.length > 0 && (
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <span className="brand-flag" aria-hidden="true">
              <i></i>
              <i></i>
              <i></i>
            </span>
            <h2 className="font-display text-lg">Boosts</h2>
          </div>
          <div className="space-y-3">
            {boostedSelections.map(({ market, selection }) => (
              <Card key={`${market.id}-${selection.id}`} className="bg-surface-2">
                <BoostedOddsRow
                  matchId={match.id}
                  matchLabel={matchLabel}
                  competition={match.competition}
                  marketId={market.id}
                  marketName={market.name}
                  selectionId={selection.id}
                  selectionName={selection.name}
                  odds={selection.odds}
                  previousOdds={selection.originalOdds!}
                  maxStakeCents={selection.maxStakeCents}
                />
              </Card>
            ))}
          </div>
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
          <MarketSelections
            matchId={match.id}
            matchLabel={matchLabel}
            competition={match.competition}
            market={matchResult}
          />
        </div>
      ) : (
        <p className="mt-6 text-text-secondary">No odds available for this match yet.</p>
      )}

      {otherMarkets.map((market) => (
        <div key={market.id} className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <span className="brand-flag" aria-hidden="true">
              <i></i>
              <i></i>
              <i></i>
            </span>
            <h2 className="font-display text-lg">{displayName('MARKET', market.name)}</h2>
          </div>
          <MarketSelections
            matchId={match.id}
            matchLabel={matchLabel}
            competition={match.competition}
            market={market}
          />
        </div>
      ))}

      {specialMarkets.length > 0 && (
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <span className="brand-flag" aria-hidden="true">
              <i></i>
              <i></i>
              <i></i>
            </span>
            <h2 className="font-display text-lg">Specials</h2>
          </div>
          <div className="space-y-4">
            {specialMarkets.map((market) => (
              <div key={market.id}>
                <p className="mb-1.5 text-xs font-semibold text-text-secondary">
                  {displayName('MARKET', market.name)}
                </p>
                <MarketSelections
                  matchId={match.id}
                  matchLabel={matchLabel}
                  competition={match.competition}
                  market={market}
                />
                {(market.maxStakeCents !== undefined || market.singlesOnly) && (
                  <p className="mt-1.5 text-[11px] text-text-secondary">
                    {[
                      market.maxStakeCents !== undefined
                        ? `Max stake: ${(market.maxStakeCents / 100).toFixed(2)} €`
                        : null,
                      market.singlesOnly ? 'Singles only' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
