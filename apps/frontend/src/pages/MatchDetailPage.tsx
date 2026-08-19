import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { BackButton } from '../components/ui/BackButton';
import { Breadcrumb, type BreadcrumbSegment } from '../components/ui/Breadcrumb';
import { Card } from '../components/ui/Card';
import { BoostIcon, SpecialsIcon } from '../components/ui/NavIcons';
import { Skeleton } from '../components/ui/Skeleton';
import { SportCountryBadge } from '../components/ui/SportCountryBadge';
import { TeamColorAccent } from '../components/ui/TeamColorAccent';
import { formatMoney } from '../lib/currency';
import { CampaignContextBanner } from '../features/bet-and-get/CampaignContextBanner';
import { useCampaignsForMatch } from '../features/bet-and-get/useCampaignsForMatch';
import { BoostedOddsRow } from '../features/bet-slip/BoostedOddsRow';
import { MarketSelections } from '../features/bet-slip/MarketSelections';
import { useDisplayNames } from '../features/display-names/useDisplayNames';
import { LeaderboardContextBanner } from '../features/leaderboards/LeaderboardContextBanner';
import { useLeaderboardsForMatch } from '../features/leaderboards/useLeaderboardsForMatch';
import { LiveMatchTracker } from '../features/match-detail/LiveMatchTracker';
import { useLiveMatch } from '../features/match-detail/useLiveMatch';
import { useMatch } from '../features/match-detail/useMatch';
import { useMatches } from '../features/odds-board/useMatches';
import { useTeamColors } from '../features/odds-board/useTeamColors';
import { fallbackTeamColor } from '../lib/fallbackTeamColor';
import { formatKickoff } from '../lib/formatKickoff';
import { groupMarketsByCategory, MARKET_CATEGORY_LABELS, type MarketCategory } from '../lib/marketCategory';
import { matchPeriodLabel } from '../lib/matchPeriodLabel';
import type { Match } from '@sportsbook/shared';

/** Same rule MatchCard uses: no kickoff shown for a match already live - a small LIVE pill instead, so a live sibling stands out in the dropdown at a glance. */
function kickoffMeta(candidate: Match) {
  return candidate.isLive ? (
    <span className="rounded-full bg-price-down px-2 py-0.5 text-[9px] font-extrabold tracking-widest text-white uppercase">
      Live
    </span>
  ) : (
    formatKickoff(new Date(candidate.kickoff))
  );
}

export default function MatchDetailPage() {
  const { matchId } = useParams();
  const [selectedCategory, setSelectedCategory] = useState<MarketCategory>('main');
  const { data: match, isPending, isError } = useMatch(matchId);
  const { data: liveState } = useLiveMatch(matchId, match?.isLive ?? false);
  const { data: allMatches } = useMatches();
  const { data: applicableCampaigns } = useCampaignsForMatch(match?.id);
  const { data: applicableLeaderboards } = useLeaderboardsForMatch(match?.id);
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
  // Match Result plus every other non-special market, grouped into a
  // small set of tabs (Main/Totals/Handicaps) instead of one heading-and-
  // Card block per market - a match with 4-5 markets otherwise reads as
  // one long undifferentiated scroll.
  const marketsByCategory = groupMarketsByCategory(matchResult ? [matchResult, ...otherMarkets] : otherMarkets);
  const availableCategories = (Object.keys(MARKET_CATEGORY_LABELS) as MarketCategory[]).filter(
    (category) => marketsByCategory[category].length > 0,
  );
  const activeCategory = availableCategories.includes(selectedCategory)
    ? selectedCategory
    : (availableCategories[0] ?? 'main');
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
            <BackButton className="shrink-0" />
            <SportCountryBadge sport={match.sport} country={match.country} size={20} />
          </>
        }
      />

      <section className="relative mt-2 overflow-hidden rounded-3xl border border-border bg-surface p-6">
        {match.isLive ? (
          <span className="absolute top-4 right-4 flex items-center gap-1.5 text-xs font-bold text-text-secondary">
            {/* A slow pulse reads as "this is happening now" without
                shouting LIVE at the player on every glance - the dot alone
                is the status, the text next to it is the detail. */}
            <span className="live-dot" aria-hidden="true" />
            {liveState && (
              <span className="tabular-nums">
                {matchPeriodLabel(liveState.period)} · {liveState.minute}'
              </span>
            )}
            <span className="sr-only">Live</span>
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
            // A pill, not bare text, so the score reads as its own distinct
            // element rather than blurring into the team names on either
            // side of it.
            <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 font-display tabular-nums">
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

        {/* Momentum sits right under the header's own score/team-names row
            (not a separate card below) - the time/part already moved into
            the corner badge above, so this block is momentum only. */}
        {match.isLive && liveState && (
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
        )}
      </section>

      {((applicableCampaigns && applicableCampaigns.length > 0) ||
        (applicableLeaderboards && applicableLeaderboards.length > 0)) && (
        <div className="mt-6 space-y-3">
          {applicableCampaigns?.map((campaign) => <CampaignContextBanner key={campaign.id} campaign={campaign} />)}
          {applicableLeaderboards?.map((campaign) => (
            <LeaderboardContextBanner key={campaign.id} campaign={campaign} />
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
            <BoostIcon width={22} height={22} />
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

      {availableCategories.length > 0 ? (
        <div className="mt-5">
          {availableCategories.length > 1 && (
            <div className="mb-3 flex gap-1.5 overflow-x-auto">
              {availableCategories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`tab${activeCategory === category ? ' active' : ''}`}
                  onClick={() => setSelectedCategory(category)}
                >
                  {MARKET_CATEGORY_LABELS[category]}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold not-italic tabular-nums ${
                      activeCategory === category ? 'bg-black/15' : 'bg-black/20'
                    }`}
                  >
                    {marketsByCategory[category].length}
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="space-y-3">
            {marketsByCategory[activeCategory].map((market) => (
              <Card key={market.id}>
                <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                  {displayName('MARKET', market.name)}
                </h2>
                <MarketSelections
                  matchId={match.id}
                  matchLabel={matchLabel}
                  competition={match.competition}
                  market={market}
                  homeTeamLabel={homeTeamLabel}
                  awayTeamLabel={awayTeamLabel}
                />
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-6 text-text-secondary">No odds available for this match yet.</p>
      )}

      {specialMarkets.length > 0 && (
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <SpecialsIcon width={22} height={22} />
            <h2 className="font-display text-lg">Specials</h2>
          </div>
          <Card className="space-y-4">
            {specialMarkets.map((market, index) => (
              <div
                key={market.id}
                className={index > 0 ? 'border-t border-border pt-4' : undefined}
              >
                <p className="mb-1.5 text-xs font-semibold text-text-secondary">
                  {displayName('MARKET', market.name)}
                </p>
                <MarketSelections
                  matchId={match.id}
                  matchLabel={matchLabel}
                  competition={match.competition}
                  market={market}
                  homeTeamLabel={homeTeamLabel}
                  awayTeamLabel={awayTeamLabel}
                />
                {(market.maxStakeCents !== undefined || market.singlesOnly) && (
                  <p className="mt-1.5 text-[11px] text-text-secondary">
                    {[
                      market.maxStakeCents !== undefined
                        ? `Max stake: ${formatMoney(market.maxStakeCents)}`
                        : null,
                      market.singlesOnly ? 'Singles only' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}
