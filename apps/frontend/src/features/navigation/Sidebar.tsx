import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CountryFlag } from '../../components/ui/CountryFlag';
import { SearchIcon } from '../../components/ui/NavIcons';
import { SportIcon } from '../../components/ui/SportIcon';
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
}

export function Sidebar({ onNavigate }: SidebarProps = {}) {
  const { data: matches } = useMatches();
  const { data: rankings } = useCompetitionRankings();
  const [query, setQuery] = useState('');
  const trimmedQuery = query.trim().toLowerCase();

  const competitionCountries = useMemo(() => competitionCountryMap(matches ?? []), [matches]);
  const filteredMatches = useMemo(() => {
    if (!trimmedQuery) return matches ?? [];
    return (matches ?? []).filter((match) =>
      [match.sport, match.country, match.competition, match.homeTeam, match.awayTeam].some((field) =>
        field.toLowerCase().includes(trimmedQuery),
      ),
    );
  }, [matches, trimmedQuery]);
  const tree = useMemo(() => buildSportTree(filteredMatches), [filteredMatches]);
  const topCompetitions = useMemo(() => {
    const ranked = [...(rankings ?? [])].sort((a, b) => a.rank - b.rank);
    const filtered = trimmedQuery
      ? ranked.filter((ranking) => ranking.competition.toLowerCase().includes(trimmedQuery))
      : ranked;
    return filtered.slice(0, MAX_QUICKLINKS);
  }, [rankings, trimmedQuery]);

  const [expandedSport, setExpandedSport] = useState<string | null>(null);
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);
  // While searching, expand every matching branch so results are visible
  // without also having to click through the accordion.
  const isSearching = trimmedQuery.length > 0;

  const hasNoResults = isSearching && topCompetitions.length === 0 && tree.length === 0;

  return (
    <nav aria-label="Sports navigation" className="space-y-5">
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

      {hasNoResults && (
        <p className="text-sm text-text-secondary">No matches found for "{query.trim()}".</p>
      )}

      {topCompetitions.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-text-muted">
            Top Competitions
          </h2>
          <ul className="space-y-1">
            {topCompetitions.map((ranking) => {
              const country = competitionCountries.get(ranking.competition);
              return (
                <li key={ranking.competition}>
                  <Link
                    to={`/sports/all?competition=${encodeURIComponent(ranking.competition)}`}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
                    onClick={onNavigate}
                  >
                    {country && <CountryFlag country={country} size={16} />}
                    <span>{ranking.competition}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {tree.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-text-muted">Sports</h2>
          <ul className="space-y-1">
            {tree.map((sportNode) => {
              const isSportOpen = isSearching || expandedSport === sportNode.sport;
              return (
                <li key={sportNode.sport}>
                  <button
                    type="button"
                    aria-expanded={isSportOpen}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm font-semibold text-text-primary transition-colors hover:bg-surface-2"
                    onClick={() => {
                      setExpandedSport(isSportOpen ? null : sportNode.sport);
                      setExpandedCountry(null);
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <SportIcon sport={sportNode.sport} size={16} />
                      <span>{sportNode.sport}</span>
                    </span>
                    <span aria-hidden="true" className="text-text-muted">
                      {isSportOpen ? '−' : '+'}
                    </span>
                  </button>

                  {isSportOpen && (
                    <ul className="mt-1 ml-2 space-y-1 border-l border-border pl-2">
                      {sportNode.countries.map((countryNode) => {
                        const isCountryOpen = isSearching || expandedCountry === countryNode.country;
                        return (
                          <li key={countryNode.country}>
                            <button
                              type="button"
                              aria-expanded={isCountryOpen}
                              className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-sm text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
                              onClick={() =>
                                setExpandedCountry(isCountryOpen ? null : countryNode.country)
                              }
                            >
                              <span className="flex items-center gap-2">
                                <CountryFlag country={countryNode.country} size={16} />
                                <span>{countryNode.country}</span>
                              </span>
                              <span aria-hidden="true" className="text-text-muted">
                                {isCountryOpen ? '−' : '+'}
                              </span>
                            </button>

                            {isCountryOpen && (
                              <ul className="mt-1 ml-2 space-y-1 border-l border-border pl-2">
                                {countryNode.competitions.map((competitionNode) => (
                                  <li key={competitionNode.competition}>
                                    <Link
                                      to={`/sports/${encodeURIComponent(sportNode.sport)}?competition=${encodeURIComponent(competitionNode.competition)}`}
                                      className="flex items-center justify-between rounded-md px-2 py-1 text-sm text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
                                      onClick={onNavigate}
                                    >
                                      <span>{competitionNode.competition}</span>
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
      )}
    </nav>
  );
}
