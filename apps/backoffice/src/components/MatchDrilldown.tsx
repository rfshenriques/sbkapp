import { useMemo, useState, type ReactNode } from 'react';
import type { Match } from '@sportsbook/shared';
import { buildMatchTree, type CompetitionNode } from '../lib/matchTree';
import { Card } from './ui/Card';
import { ChevronIcon } from './ui/ChevronIcon';
import { Skeleton } from './ui/Skeleton';

interface ExpandButtonProps {
  isExpanded: boolean;
  onClick: () => void;
  label: ReactNode;
  count: number;
}

function ExpandButton({ isExpanded, onClick, label, count }: ExpandButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={isExpanded}
      className="flex w-full items-center justify-between gap-2 py-1.5 text-left text-sm font-medium hover:text-brand"
    >
      <span>
        {label} <span className="text-text-muted">({count})</span>
      </span>
      <ChevronIcon className={`h-4 w-4 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
    </button>
  );
}

export interface MatchDrilldownProps {
  matches: Match[] | undefined;
  isLoading?: boolean;
  isError?: boolean;
  emptyMessage?: string;
  /** Renders the contents of one expanded league - typically the match list, each match's own expand/collapse for markets, etc. */
  renderLeague: (node: CompetitionNode) => ReactNode;
}

/**
 * Sport > country > league drill-down used by every trading tool page
 * (suspensions, odds overrides, manual markets, boosts) instead of a flat
 * match list - one thing open per level, so drilling into a new sport
 * collapses whatever country/league was open before. The match-level UI
 * itself is deliberately not this component's concern (it varies a lot per
 * page, from a simple suspend button to a nested market/selection
 * accordion) - callers supply it via renderLeague.
 */
export function MatchDrilldown({
  matches,
  isLoading,
  isError,
  emptyMessage = 'No live matches right now.',
  renderLeague,
}: MatchDrilldownProps) {
  const tree = useMemo(() => buildMatchTree(matches ?? []), [matches]);
  const [expandedSport, setExpandedSport] = useState<string | null>(null);
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);
  const [expandedLeague, setExpandedLeague] = useState<string | null>(null);

  function toggleSport(sport: string) {
    setExpandedSport((previous) => (previous === sport ? null : sport));
    setExpandedCountry(null);
    setExpandedLeague(null);
  }
  function toggleCountry(country: string) {
    setExpandedCountry((previous) => (previous === country ? null : country));
    setExpandedLeague(null);
  }
  function toggleLeague(league: string) {
    setExpandedLeague((previous) => (previous === league ? null : league));
  }

  if (isLoading) {
    return (
      <div className="space-y-2" aria-label="Loading live matches" role="status">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }
  if (isError) {
    return <p className="text-sm text-danger">Failed to load live matches.</p>;
  }
  if (tree.length === 0) {
    return <p className="text-sm text-text-secondary">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-2">
      {tree.map((sportNode) => {
        const isSportExpanded = expandedSport === sportNode.sport;
        return (
          <Card key={sportNode.sport}>
            <ExpandButton
              isExpanded={isSportExpanded}
              onClick={() => toggleSport(sportNode.sport)}
              label={sportNode.sport}
              count={sportNode.matchCount}
            />
            {isSportExpanded && (
              <div className="mt-1 space-y-1 border-t border-border pl-3 pt-2">
                {sportNode.countries.map((countryNode) => {
                  const isCountryExpanded = expandedCountry === countryNode.country;
                  return (
                    <div key={countryNode.country}>
                      <ExpandButton
                        isExpanded={isCountryExpanded}
                        onClick={() => toggleCountry(countryNode.country)}
                        label={countryNode.country}
                        count={countryNode.matchCount}
                      />
                      {isCountryExpanded && (
                        <div className="space-y-1 border-t border-border pl-3 pt-2">
                          {countryNode.competitions.map((leagueNode) => {
                            const isLeagueExpanded = expandedLeague === leagueNode.competition;
                            return (
                              <div key={leagueNode.competition}>
                                <ExpandButton
                                  isExpanded={isLeagueExpanded}
                                  onClick={() => toggleLeague(leagueNode.competition)}
                                  label={leagueNode.competition}
                                  count={leagueNode.matches.length}
                                />
                                {isLeagueExpanded && (
                                  <div className="space-y-2 border-t border-border pl-3 pt-2">
                                    {renderLeague(leagueNode)}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
