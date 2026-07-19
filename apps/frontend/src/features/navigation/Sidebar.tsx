import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMatches } from '../odds-board/useMatches';
import { useCompetitionRankings } from '../odds-board/useCompetitionRankings';
import { buildSportTree } from './buildSportTree';

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
  const tree = useMemo(() => buildSportTree(matches ?? []), [matches]);
  const topCompetitions = useMemo(
    () => [...(rankings ?? [])].sort((a, b) => a.rank - b.rank).slice(0, MAX_QUICKLINKS),
    [rankings],
  );

  const [expandedSport, setExpandedSport] = useState<string | null>(null);
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);

  return (
    <nav aria-label="Sports navigation" className="space-y-5">
      {topCompetitions.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-text-muted">
            Top Competitions
          </h2>
          <ul className="space-y-1">
            {topCompetitions.map((ranking) => (
              <li key={ranking.competition}>
                <Link
                  to={`/sports/all?competition=${encodeURIComponent(ranking.competition)}`}
                  className="block rounded-md px-2 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
                  onClick={onNavigate}
                >
                  {ranking.competition}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tree.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-text-muted">Sports</h2>
          <ul className="space-y-1">
            {tree.map((sportNode) => {
              const isSportOpen = expandedSport === sportNode.sport;
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
                    <span>{sportNode.sport}</span>
                    <span aria-hidden="true" className="text-text-muted">
                      {isSportOpen ? '−' : '+'}
                    </span>
                  </button>

                  {isSportOpen && (
                    <ul className="mt-1 ml-2 space-y-1 border-l border-border pl-2">
                      {sportNode.countries.map((countryNode) => {
                        const isCountryOpen = expandedCountry === countryNode.country;
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
                              <span>{countryNode.country}</span>
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
