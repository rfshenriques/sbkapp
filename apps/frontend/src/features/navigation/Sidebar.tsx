import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronIcon } from '../../components/ui/ChevronIcon';
import { CountryFlag } from '../../components/ui/CountryFlag';
import { SearchIcon } from '../../components/ui/NavIcons';
import { SportCountryBadge } from '../../components/ui/SportCountryBadge';
import { SportIcon } from '../../components/ui/SportIcon';
import { cn } from '../../lib/cn';
import { useDisplayNames } from '../display-names/useDisplayNames';
import { useMatches } from '../odds-board/useMatches';
import { useCompetitionRankings } from '../odds-board/useCompetitionRankings';
import { useCompetitionQuicklinks } from '../odds-board/useCompetitionQuicklinks';
import { rankMapFromRankings } from '../odds-board/sortMatches';
import { buildSportTree, competitionCountryMap } from './buildSportTree';

/** Sidebar stays short and scannable - the rest is reachable through the sport/country/competition drill-down below. */
const MAX_QUICKLINKS = 6;

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
  const { data: matches } = useMatches();
  const { data: rankings } = useCompetitionRankings();
  const { data: quicklinks } = useCompetitionQuicklinks();
  const displayName = useDisplayNames();
  const [query, setQuery] = useState('');
  const trimmedQuery = query.trim().toLowerCase();
  const isSearching = trimmedQuery.length > 0;

  const competitionCountries = useMemo(() => competitionCountryMap(matches ?? []), [matches]);

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

  const hasNoResults = isSearching && !hasMatchResults && topCompetitions.length === 0 && tree.length === 0;

  return (
    <nav aria-label="Sports navigation" className="space-y-5">
      {/* Pinned to the top of whichever scroll container this sits in
          (desktop column or mobile full-screen drawer) so it stays reachable
          however far the sport/country/competition tree below is scrolled. */}
      <div className={cn('sticky -top-4 z-10 -mx-4 -mt-4 rounded-t-2xl px-4 pt-4 pb-3', stickyBgClassName)}>
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
            placeholder="Search teams, competitions..."
            aria-label="Search sports and competitions"
            className="w-full rounded-xl border border-border bg-surface-2 py-2 pr-3 pl-8 text-base text-text-primary placeholder:text-text-muted focus:ring-1 focus:ring-brand focus:outline-none sm:text-sm"
          />
        </div>
      </div>

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
                    className="flex items-center gap-3 px-3 py-2.5 text-sm text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
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

      {showLeagues && topCompetitions.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-text-muted">
            Top Competitions
          </h2>
          <div className="overflow-hidden rounded-2xl bg-surface-2">
            <ul className="divide-y divide-border/60">
              {topCompetitions.map((quicklink) => {
                const country = competitionCountries.get(quicklink.competition);
                return (
                  <li key={quicklink.competition}>
                    <Link
                      to={`/sports/all?competition=${encodeURIComponent(quicklink.competition)}`}
                      className="flex items-center gap-3 px-3 py-2.5 text-sm text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
                      onClick={onNavigate}
                    >
                      {country ? (
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

      {showLeagues && tree.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-text-muted">Sports</h2>
          <div className="overflow-hidden rounded-2xl bg-surface-2">
            <ul className="divide-y divide-border/60">
              {tree.map((sportNode) => {
                const isSportOpen = isSearching || expandedSport === sportNode.sport;
                return (
                  <li key={sportNode.sport}>
                    <button
                      type="button"
                      aria-expanded={isSportOpen}
                      className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-white/5"
                      onClick={() => {
                        setExpandedSport(isSportOpen ? null : sportNode.sport);
                        setExpandedCountry(null);
                      }}
                    >
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
                        <li>
                          <Link
                            to={`/sports/${encodeURIComponent(sportNode.sport)}`}
                            className="flex items-center py-2.5 pr-3 pl-8 text-sm font-semibold text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
                            onClick={onNavigate}
                          >
                            All matches
                          </Link>
                        </li>
                        {sportNode.countries.map((countryNode) => {
                          const isCountryOpen = isSearching || expandedCountry === countryNode.country;
                          return (
                            <li key={countryNode.country}>
                              <button
                                type="button"
                                aria-expanded={isCountryOpen}
                                className="flex w-full items-center gap-3 py-2.5 pr-3 pl-8 text-left transition-colors hover:bg-white/5"
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
                                  {countryNode.competitions.map((competitionNode) => (
                                    <li key={competitionNode.competition}>
                                      <Link
                                        to={`/sports/${encodeURIComponent(sportNode.sport)}?competition=${encodeURIComponent(competitionNode.competition)}`}
                                        className="flex items-center justify-between py-2.5 pr-3 pl-14 text-sm text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
                                        onClick={onNavigate}
                                      >
                                        <span>
                                          {displayName('COUNTRY', countryNode.country)} -{' '}
                                          {displayName('COMPETITION', competitionNode.competition)}
                                        </span>
                                        <span className="text-xs text-text-muted">
                                          {competitionNode.matchCount}
                                        </span>
                                      </Link>
                                    </li>
                                  ))}
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
    </nav>
  );
}
