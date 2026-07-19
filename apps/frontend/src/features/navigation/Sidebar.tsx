import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronIcon } from '../../components/ui/ChevronIcon';
import { CountryFlag } from '../../components/ui/CountryFlag';
import { SearchIcon } from '../../components/ui/NavIcons';
import { SportCountryBadge } from '../../components/ui/SportCountryBadge';
import { SportIcon } from '../../components/ui/SportIcon';
import { cn } from '../../lib/cn';
import { useMatches } from '../odds-board/useMatches';
import { useCompetitionRankings } from '../odds-board/useCompetitionRankings';
import { buildSportTree, competitionCountryMap } from './buildSportTree';

/** Sidebar stays short and scannable - the rest is reachable through the sport/country/competition drill-down below. */
const MAX_QUICKLINKS = 6;

/**
 * Sidebar content only - no drawer chrome or desktop column wrapper, same
 * split as BetSlipPanel. AppShell supplies the persistent desktop aside and
 * the mobile drawer around this.
 *
 * "Top Competitions" quicklinks reuse the existing staff-configured
 * CompetitionRanking data (already backoffice-editable via
 * admin/competition-rankings) as a practical stand-in for real quicklinks -
 * a genuinely automatic "what's actually being bet on" ranking is a later
 * exploration, not backed by any data yet.
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
  const tree = useMemo(() => buildSportTree(treeSourceMatches), [treeSourceMatches]);
  const topCompetitions = useMemo(() => {
    if (!showLeagues) return [];
    const ranked = [...(rankings ?? [])].sort((a, b) => a.rank - b.rank);
    const filtered = isSearching
      ? ranked.filter((ranking) => ranking.competition.toLowerCase().includes(trimmedQuery))
      : ranked;
    return filtered.slice(0, MAX_QUICKLINKS);
  }, [rankings, trimmedQuery, isSearching, showLeagues]);

  const [expandedSport, setExpandedSport] = useState<string | null>(null);
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);

  const hasNoResults = isSearching && !hasMatchResults && topCompetitions.length === 0 && tree.length === 0;

  return (
    <nav aria-label="Sports navigation" className="space-y-5">
      {/* Pinned to the top of whichever scroll container this sits in
          (desktop column or mobile full-screen drawer) so it stays reachable
          however far the sport/country/competition tree below is scrolled. */}
      <div className={cn('sticky -top-4 z-10 -mx-4 -mt-4 rounded-t-lg px-4 pt-4 pb-3', stickyBgClassName)}>
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
            className="w-full rounded-md border border-border bg-surface-2 py-2 pr-3 pl-8 text-sm text-text-primary placeholder:text-text-muted focus:ring-1 focus:ring-brand focus:outline-none"
          />
        </div>
      </div>

      {hasNoResults && (
        <p className="text-sm text-text-secondary">No matches found for "{query.trim()}".</p>
      )}

      {hasMatchResults && (
        <div>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-text-muted">Matches</h2>
          <div className="overflow-hidden rounded-lg bg-surface-2">
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
                        {match.homeTeam} vs {match.awayTeam}
                      </span>
                      <span className="block truncate text-xs text-text-muted">{match.competition}</span>
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
          <div className="overflow-hidden rounded-lg bg-surface-2">
            <ul className="divide-y divide-border/60">
              {topCompetitions.map((ranking) => {
                const country = competitionCountries.get(ranking.competition);
                return (
                  <li key={ranking.competition}>
                    <Link
                      to={`/sports/all?competition=${encodeURIComponent(ranking.competition)}`}
                      className="flex items-center gap-3 px-3 py-2.5 text-sm text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
                      onClick={onNavigate}
                    >
                      {country ? (
                        <CountryFlag country={country} size={22} />
                      ) : (
                        <span className="inline-block h-[22px] w-[22px] shrink-0" />
                      )}
                      <span>{ranking.competition}</span>
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
          <div className="overflow-hidden rounded-lg bg-surface-2">
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
                        {sportNode.sport}
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
                      <ul className="divide-y divide-border/60 bg-black/10">
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
                                  {countryNode.country}
                                </span>
                                <ChevronIcon
                                  className={cn(
                                    'h-4 w-4 shrink-0 text-text-muted transition-transform',
                                    isCountryOpen && 'rotate-180',
                                  )}
                                />
                              </button>

                              {isCountryOpen && (
                                <ul className="divide-y divide-border/60 bg-black/10">
                                  {countryNode.competitions.map((competitionNode) => (
                                    <li key={competitionNode.competition}>
                                      <Link
                                        to={`/sports/${encodeURIComponent(sportNode.sport)}?competition=${encodeURIComponent(competitionNode.competition)}`}
                                        className="flex items-center justify-between py-2.5 pr-3 pl-14 text-sm text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
                                        onClick={onNavigate}
                                      >
                                        <span>
                                          {countryNode.country} - {competitionNode.competition}
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
