import { useEffect, useMemo, useRef, useState, type FocusEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronIcon } from '../../components/ui/ChevronIcon';
import { CountryFlag } from '../../components/ui/CountryFlag';
import { BoostIcon, SearchIcon, SpecialsIcon, TrophyIcon } from '../../components/ui/NavIcons';
import { SportCountryBadge } from '../../components/ui/SportCountryBadge';
import { SportIcon } from '../../components/ui/SportIcon';
import { cn } from '../../lib/cn';
import { track } from '../../lib/analytics';
import { sortSportsByPriority } from '../../lib/sportPriority';
import { useDisplayNames } from '../display-names/useDisplayNames';
import { useMatches } from '../odds-board/useMatches';
import { useBoosts } from '../odds-board/useBoosts';
import { useSpecials } from '../odds-board/useSpecials';
import { useCompetitionRankings } from '../odds-board/useCompetitionRankings';
import { useCompetitionQuicklinks } from '../odds-board/useCompetitionQuicklinks';
import { rankMapFromRankings } from '../odds-board/sortMatches';
import { useLeaderboardCampaigns } from '../leaderboards/useLeaderboardCampaigns';
import { usePromoCards } from '../promo-cards/usePromoCards';
import { buildSportTree, competitionCountryMap, competitionSportMap } from './buildSportTree';

/** Sidebar stays short and scannable - the rest is reachable through the sport/country/competition drill-down below. */
const MAX_QUICKLINKS = 6;

/** Focus suggestions stay to a single row/short list - a fast jumping-off point, not a second copy of the full drill-down tree already below. */
const MAX_SUGGESTED_SPORTS = 8;

/** A checklist glyph for the "Select multiple" toggle - two checked boxes stacked, echoing the multi-select checkboxes the tree switches into once tapped. */
function MultiSelectIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={14}
      height={14}
      className={props.className}
    >
      <rect x="2.5" y="2.5" width="6" height="6" rx="1.3" />
      <path d="M4 5.5 5.2 6.7 7 4.5" />
      <rect x="2.5" y="11.5" width="6" height="6" rx="1.3" />
      <path d="M4 14.5 5.2 15.7 7 13.5" />
      <line x1="11.5" y1="5.5" x2="17.5" y2="5.5" />
      <line x1="11.5" y1="14.5" x2="17.5" y2="14.5" />
    </svg>
  );
}

/** How many of this quicklink's items are actually available right now - omitted entirely at 0 rather than showing a bare "0" badge on every fresh page load. */
function QuicklinkCount({ count }: { count: number }) {
  if (count === 0) {
    return null;
  }
  return (
    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-highlight/15 px-1.5 text-[10px] font-bold text-highlight tabular-nums">
      {count}
    </span>
  );
}

/**
 * Sidebar content only - no drawer chrome or desktop column wrapper, same
 * split as BetSlipPanel. AppShell supplies the persistent desktop aside and
 * the mobile drawer around this.
 *
 * "Top Competitions" quicklinks are a separate staff-curated cross-sport
 * shortcut list (backoffice-editable via the CMS Quicklinks tab / admin/
 * competition-quicklinks), independent of CompetitionRanking - which
 * instead orders each sport's own competitions in the drill-down tree
 * below.
 */
export interface SidebarProps {
  /** Called when a competition link is clicked - the mobile drawer instance uses this to close itself on navigation. */
  onNavigate?: () => void;
  /** Background behind the sticky search bar has to match whichever scroll container it's pinned inside - the desktop column and the mobile full-screen drawer use different surface shades. */
  stickyBgClassName?: string;
}

export function Sidebar({ onNavigate, stickyBgClassName = 'bg-surface' }: SidebarProps = {}) {
  const navigate = useNavigate();
  const { data: matches } = useMatches();
  const { data: rankings } = useCompetitionRankings();
  const { data: quicklinks } = useCompetitionQuicklinks();
  // Quicklink counts - each endpoint already resolves the viewer from an
  // optional auth token server-side (see PublicBoostsController/
  // PublicSpecialsController/PromoCardService.listForViewer/
  // LeaderboardPublicController.list), so the same query naturally returns
  // a smaller, player-specific count once logged in (segment-gated, and
  // for Challenges also redemption-aware) without this component needing
  // to branch on isAuthenticated itself.
  const { data: boosts } = useBoosts();
  const { data: specials } = useSpecials();
  const { data: leaderboardCampaigns } = useLeaderboardCampaigns();
  const { data: promoCards } = usePromoCards();
  const boostsCount = boosts?.length ?? 0;
  const specialsCount = specials?.length ?? 0;
  const leaderboardsCount = leaderboardCampaigns?.length ?? 0;
  const challengesCount = (promoCards ?? []).filter((card) => card.status === 'ACTIVE').length;
  const displayName = useDisplayNames();
  const [query, setQuery] = useState('');
  const trimmedQuery = query.trim().toLowerCase();
  const isSearching = trimmedQuery.length > 0;

  // Clicking into the (still-empty) search box surfaces a quick "top
  // sports / popular competitions" overlay above whatever's already below
  // it - a faster jumping-off point than scrolling past it to the same
  // content, for a player who wants to browse broadly rather than type a
  // specific team. Closes on blur, Escape, or picking a suggestion; typing
  // a query supersedes it with the real search results below instead.
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const showSuggestions = isSearchFocused && !isSearching;

  function handleSearchAreaBlur(event: FocusEvent<HTMLDivElement>) {
    const nextFocusTarget = event.relatedTarget as Node | null;
    if (nextFocusTarget && searchContainerRef.current?.contains(nextFocusTarget)) {
      return;
    }
    setIsSearchFocused(false);
  }

  const competitionCountries = useMemo(() => competitionCountryMap(matches ?? []), [matches]);
  const competitionSports = useMemo(() => competitionSportMap(matches ?? []), [matches]);
  const suggestedSports = useMemo(
    () => sortSportsByPriority(Array.from(new Set((matches ?? []).map((match) => match.sport)))).slice(0, MAX_SUGGESTED_SPORTS),
    [matches],
  );

  // Most searches (a team, a country) are looking for matches to bet on -
  // show those directly rather than making the player drill into a league
  // first. The sport/country/competition tree only comes back into play as
  // a fallback when the search matches no actual match.
  const matchingMatches = useMemo(() => {
    if (!isSearching) return [];
    return (matches ?? []).filter((match) =>
      [match.sport, match.country, match.competition, match.homeTeam, match.awayTeam].some((field) =>
        field.toLowerCase().includes(trimmedQuery),
      ),
    );
  }, [matches, trimmedQuery, isSearching]);
  const hasMatchResults = isSearching && matchingMatches.length > 0;

  // Debounced rather than one event per keystroke - only the query the
  // player actually settles on is worth a row, and matchCount doubles as a
  // signal for searches that found nothing (a team/competition we don't
  // cover yet).
  useEffect(() => {
    if (!isSearching) return;
    const timer = setTimeout(() => {
      track('SEARCH', { metadata: { query: trimmedQuery, matchCount: matchingMatches.length } });
    }, 600);
    return () => clearTimeout(timer);
  }, [trimmedQuery, isSearching, matchingMatches.length]);

  // Leagues/quicklinks render whenever not searching, or as the fallback
  // when a search finds no matches to show directly.
  const showLeagues = !isSearching || !hasMatchResults;
  const treeSourceMatches = showLeagues ? (isSearching ? matchingMatches : (matches ?? [])) : [];
  const rankByCompetition = useMemo(() => rankMapFromRankings(rankings ?? []), [rankings]);
  const tree = useMemo(
    () => buildSportTree(treeSourceMatches, rankByCompetition),
    [treeSourceMatches, rankByCompetition],
  );
  const competitionsWithMatches = useMemo(
    () => new Set((matches ?? []).map((match) => match.competition)),
    [matches],
  );
  const topCompetitions = useMemo(() => {
    if (!showLeagues) return [];
    // A quicklinked competition drops out the moment it has no matches,
    // rather than showing an empty shortcut - the next one slides up into
    // its spot automatically since this filters before slicing to
    // MAX_QUICKLINKS below, not after.
    const ordered = [...(quicklinks ?? [])]
      .filter((quicklink) => competitionsWithMatches.has(quicklink.competition))
      .sort((a, b) => a.order - b.order);
    const filtered = isSearching
      ? ordered.filter((quicklink) => quicklink.competition.toLowerCase().includes(trimmedQuery))
      : ordered;
    return filtered.slice(0, MAX_QUICKLINKS);
  }, [quicklinks, trimmedQuery, isSearching, showLeagues, competitionsWithMatches]);

  const [expandedSport, setExpandedSport] = useState<string | null>(null);
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);

  // "Select multiple" lets a player pick several sports and/or competitions
  // out of the drill-down tree, then jump to BrowsePage with all of their
  // matches at once - a separate mode rather than always-on checkboxes so
  // the tree's normal one-tap-to-navigate behavior stays the default.
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedSports, setSelectedSports] = useState<Set<string>>(new Set());
  const [selectedCompetitions, setSelectedCompetitions] = useState<Set<string>>(new Set());

  function resetMultiSelect() {
    setIsMultiSelectMode(false);
    setSelectedSports(new Set());
    setSelectedCompetitions(new Set());
  }

  function toggleSelectedSport(sport: string) {
    setSelectedSports((previous) => {
      const next = new Set(previous);
      if (next.has(sport)) next.delete(sport);
      else next.add(sport);
      return next;
    });
  }

  function toggleSelectedCompetition(competition: string) {
    setSelectedCompetitions((previous) => {
      const next = new Set(previous);
      if (next.has(competition)) next.delete(competition);
      else next.add(competition);
      return next;
    });
  }

  const totalSelected = selectedSports.size + selectedCompetitions.size;

  function applyMultiSelect() {
    const params = new URLSearchParams();
    if (selectedSports.size > 0) params.set('sports', [...selectedSports].join(','));
    if (selectedCompetitions.size > 0) params.set('competitions', [...selectedCompetitions].join(','));
    navigate(`/browse?${params.toString()}`);
    onNavigate?.();
    resetMultiSelect();
  }

  const hasNoResults = isSearching && !hasMatchResults && topCompetitions.length === 0 && tree.length === 0;

  return (
    <nav aria-label="Sports navigation" className="space-y-5">
      {/* Pinned to the top of whichever scroll container this sits in
          (desktop column or mobile full-screen drawer) so it stays reachable
          however far the sport/country/competition tree below is scrolled. */}
      <div
        ref={searchContainerRef}
        onBlur={handleSearchAreaBlur}
        className={cn('sticky -top-4 z-10 -mx-4 -mt-4 rounded-t-2xl px-4 pt-4 pb-3', stickyBgClassName)}
      >
        <div className="relative">
          <SearchIcon
            width={15}
            height={15}
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-text-muted"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') event.currentTarget.blur();
            }}
            placeholder="Search teams, competitions..."
            aria-label="Search sports and competitions"
            className="w-full rounded-xl border border-border bg-surface-2 py-2 pr-3 pl-8 text-base text-text-primary placeholder:text-text-muted focus:ring-1 focus:ring-brand focus:outline-none sm:text-sm"
          />
        </div>

        {showSuggestions && (
          <div className="fade-in-down absolute inset-x-4 top-full z-10 mt-2 space-y-3 rounded-2xl border border-border bg-surface p-3 shadow-lg">
            {suggestedSports.length > 0 && (
              <div>
                <h2 className="mb-1.5 text-xs font-bold uppercase tracking-widest text-text-muted">
                  Top sports
                </h2>
                <div className="scrollbar-hide flex gap-1.5 overflow-x-auto" data-horizontal-scroll="true">
                  {suggestedSports.map((sport) => (
                    <Link
                      key={sport}
                      to={`/sports/${encodeURIComponent(sport)}`}
                      onClick={() => {
                        setIsSearchFocused(false);
                        onNavigate?.();
                      }}
                      className="tab shrink-0"
                    >
                      <SportIcon sport={sport} size={16} />
                      {displayName('SPORT', sport)}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {topCompetitions.length > 0 && (
              <div>
                <h2 className="mb-1.5 text-xs font-bold uppercase tracking-widest text-text-muted">
                  Popular competitions
                </h2>
                <ul className="overflow-hidden rounded-xl bg-surface-2">
                  {topCompetitions.map((quicklink) => {
                    const country = competitionCountries.get(quicklink.competition);
                    const sport = competitionSports.get(quicklink.competition);
                    return (
                      <li key={quicklink.competition} className="border-b border-border/60 last:border-b-0">
                        <Link
                          to={
                            sport
                              ? `/sports/${encodeURIComponent(sport)}?competition=${encodeURIComponent(quicklink.competition)}`
                              : `/sports/all?competition=${encodeURIComponent(quicklink.competition)}`
                          }
                          onClick={() => {
                            setIsSearchFocused(false);
                            onNavigate?.();
                          }}
                          className="flex items-center gap-3 px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                        >
                          {sport && country ? (
                            <SportCountryBadge sport={sport} country={country} size={20} />
                          ) : country ? (
                            <CountryFlag country={country} size={20} />
                          ) : (
                            <span className="inline-block h-5 w-5 shrink-0" />
                          )}
                          <span>{displayName('COMPETITION', quicklink.competition)}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {!isSearching && (
        <div className="grid grid-cols-2 gap-2">
          <Link
            to="/boosts"
            onClick={onNavigate}
            className="flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-hover"
          >
            <BoostIcon width={18} height={18} className="text-highlight" />
            Boosts
            <QuicklinkCount count={boostsCount} />
          </Link>
          <Link
            to="/specials"
            onClick={onNavigate}
            className="flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-hover"
          >
            <SpecialsIcon width={18} height={18} className="text-highlight" />
            Specials
            <QuicklinkCount count={specialsCount} />
          </Link>
          <Link
            to="/leaderboards"
            onClick={onNavigate}
            className="flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-hover"
          >
            <TrophyIcon width={18} height={18} className="text-highlight" />
            Leaderboards
            <QuicklinkCount count={leaderboardsCount} />
          </Link>
          <Link
            to="/challenges"
            onClick={onNavigate}
            className="flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-hover"
          >
            <TrophyIcon width={18} height={18} className="text-highlight" />
            Challenges
            <QuicklinkCount count={challengesCount} />
          </Link>
        </div>
      )}

      {hasNoResults && (
        <p className="text-sm text-text-secondary">No matches found for "{query.trim()}".</p>
      )}

      {hasMatchResults && (
        <div>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-text-muted">Matches</h2>
          <div className="overflow-hidden rounded-2xl bg-surface-2">
            <ul className="divide-y divide-border/60">
              {matchingMatches.map((match) => (
                <li key={match.id}>
                  <Link
                    to={`/matches/${match.id}`}
                    className="flex items-center gap-3 px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                    onClick={onNavigate}
                  >
                    <SportCountryBadge sport={match.sport} country={match.country} size={22} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-text-primary">
                        {displayName('TEAM', match.homeTeam)} vs {displayName('TEAM', match.awayTeam)}
                      </span>
                      <span className="block truncate text-xs text-text-muted">
                        {displayName('COMPETITION', match.competition)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {!showSuggestions && showLeagues && topCompetitions.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-text-muted">
            Top Competitions
          </h2>
          <div className="overflow-hidden rounded-2xl bg-surface-2">
            <ul className="divide-y divide-border/60">
              {topCompetitions.map((quicklink) => {
                const country = competitionCountries.get(quicklink.competition);
                const sport = competitionSports.get(quicklink.competition);
                return (
                  <li key={quicklink.competition}>
                    <Link
                      // Straight to the competition's own sport page once a
                      // live match has told us what sport it is - only
                      // falls back to the /sports/all umbrella (no per-sport
                      // icon available there) for a quicklink with zero
                      // scheduled matches right now.
                      to={
                        sport
                          ? `/sports/${encodeURIComponent(sport)}?competition=${encodeURIComponent(quicklink.competition)}`
                          : `/sports/all?competition=${encodeURIComponent(quicklink.competition)}`
                      }
                      className="flex items-center gap-3 px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                      onClick={onNavigate}
                    >
                      {sport && country ? (
                        <SportCountryBadge sport={sport} country={country} size={22} />
                      ) : country ? (
                        <CountryFlag country={country} size={22} />
                      ) : (
                        <span className="inline-block h-[22px] w-[22px] shrink-0" />
                      )}
                      <span>{displayName('COMPETITION', quicklink.competition)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {!showSuggestions && showLeagues && tree.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-text-muted">Sports</h2>
            <button
              type="button"
              onClick={() => (isMultiSelectMode ? resetMultiSelect() : setIsMultiSelectMode(true))}
              className="flex items-center gap-1 text-xs font-semibold text-highlight"
            >
              {!isMultiSelectMode && <MultiSelectIcon />}
              {isMultiSelectMode ? 'Cancel' : 'Select multiple'}
            </button>
          </div>
          <div className="overflow-hidden rounded-2xl bg-surface-2">
            <ul className="divide-y divide-border/60">
              {tree.map((sportNode) => {
                const isSportOpen = isSearching || expandedSport === sportNode.sport;
                const isSportSelected = selectedSports.has(sportNode.sport);
                return (
                  <li key={sportNode.sport}>
                    <button
                      type="button"
                      aria-expanded={isSportOpen}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-hover"
                      onClick={() => {
                        setExpandedSport(isSportOpen ? null : sportNode.sport);
                        setExpandedCountry(null);
                      }}
                    >
                      {isMultiSelectMode && (
                        <input
                          type="checkbox"
                          checked={isSportSelected}
                          onChange={() => toggleSelectedSport(sportNode.sport)}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={`Select ${displayName('SPORT', sportNode.sport)}`}
                          className="h-4 w-4 shrink-0"
                        />
                      )}
                      <SportIcon sport={sportNode.sport} size={28} />
                      <span className="flex-1 text-sm font-semibold text-text-primary">
                        {displayName('SPORT', sportNode.sport)}
                      </span>
                      <ChevronIcon
                        className={cn(
                          'h-4 w-4 shrink-0 text-text-muted transition-transform',
                          isSportOpen && 'rotate-180',
                        )}
                      />
                    </button>

                    {/* Nested levels read as "deeper" via a lighter block
                        background rather than border lines. */}
                    {isSportOpen && (
                      <ul className="fade-in-down divide-y divide-border/60 bg-black/10">
                        {!isMultiSelectMode && (
                          <li>
                            <Link
                              to={`/sports/${encodeURIComponent(sportNode.sport)}`}
                              className="flex items-center py-2 pr-3 pl-8 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                              onClick={onNavigate}
                            >
                              All matches
                            </Link>
                          </li>
                        )}
                        {sportNode.countries.map((countryNode) => {
                          const isCountryOpen = isSearching || expandedCountry === countryNode.country;
                          return (
                            <li key={countryNode.country}>
                              <button
                                type="button"
                                aria-expanded={isCountryOpen}
                                className="flex w-full items-center gap-3 py-2 pr-3 pl-8 text-left transition-colors hover:bg-surface-hover"
                                onClick={() =>
                                  setExpandedCountry(isCountryOpen ? null : countryNode.country)
                                }
                              >
                                <CountryFlag country={countryNode.country} size={24} />
                                <span className="flex-1 text-sm text-text-secondary">
                                  {displayName('COUNTRY', countryNode.country)}
                                </span>
                                <ChevronIcon
                                  className={cn(
                                    'h-4 w-4 shrink-0 text-text-muted transition-transform',
                                    isCountryOpen && 'rotate-180',
                                  )}
                                />
                              </button>

                              {isCountryOpen && (
                                <ul className="fade-in-down divide-y divide-border/60 bg-black/10">
                                  {countryNode.competitions.map((competitionNode) => {
                                    const isCompetitionSelected = selectedCompetitions.has(
                                      competitionNode.competition,
                                    );
                                    const competitionLabel = (
                                      <>
                                        <span>
                                          {displayName('COUNTRY', countryNode.country)} -{' '}
                                          {displayName('COMPETITION', competitionNode.competition)}
                                        </span>
                                        <span className="text-xs text-text-muted">
                                          {competitionNode.matchCount}
                                        </span>
                                      </>
                                    );
                                    return (
                                      <li key={competitionNode.competition}>
                                        {isMultiSelectMode ? (
                                          <label className="flex cursor-pointer items-center justify-between gap-2 py-2 pr-3 pl-14 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary">
                                            <span className="flex items-center gap-2">
                                              <input
                                                type="checkbox"
                                                checked={isCompetitionSelected}
                                                onChange={() =>
                                                  toggleSelectedCompetition(competitionNode.competition)
                                                }
                                                aria-label={`Select ${displayName('COMPETITION', competitionNode.competition)}`}
                                                className="h-4 w-4 shrink-0"
                                              />
                                              {competitionLabel}
                                            </span>
                                          </label>
                                        ) : (
                                          <Link
                                            to={`/sports/${encodeURIComponent(sportNode.sport)}?competition=${encodeURIComponent(competitionNode.competition)}`}
                                            className="flex items-center justify-between py-2 pr-3 pl-14 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                                            onClick={onNavigate}
                                          >
                                            {competitionLabel}
                                          </Link>
                                        )}
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {isMultiSelectMode && totalSelected > 0 && (
        <div className={cn('sticky bottom-0 z-10 -mx-4 -mb-4 px-4 pt-3 pb-4', stickyBgClassName)}>
          <button type="button" onClick={applyMultiSelect} className="btn-primary w-full">
            Apply ({totalSelected})
          </button>
        </div>
      )}
    </nav>
  );
}
