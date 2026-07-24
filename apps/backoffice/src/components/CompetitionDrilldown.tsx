import { useMemo, useState, type ReactNode } from 'react';
import type { Match } from '@sportsbook/shared';
import { buildMatchTree } from '../lib/matchTree';
import { Card } from './ui/Card';
import { ChevronIcon } from './ui/ChevronIcon';

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

export interface CompetitionDrilldownProps {
  matches: Match[] | undefined;
  isLoading?: boolean;
  isError?: boolean;
  emptyMessage?: string;
  /** Renders one competition row - a country's competitions all render as a flat list, no further drill-down (a competition is the unit of action for suspensions/tiers/margins/rankings). */
  renderCompetition: (competition: string, country: string, sport: string) => ReactNode;
}

/**
 * Sport > country drill-down that lists competitions directly once a
 * country is expanded - used by every page whose unit of action is a whole
 * competition rather than an individual match (competition suspensions,
 * competition tiers, per-sport margins, competition rankings). See
 * MatchDrilldown for the deeper sport > country > league > match version
 * trading tools that act on individual matches use instead.
 */
export function CompetitionDrilldown({
  matches,
  isLoading,
  isError,
  emptyMessage = "No competitions yet - they'll appear here once matches are live.",
  renderCompetition,
}: CompetitionDrilldownProps) {
  const tree = useMemo(() => buildMatchTree(matches ?? []), [matches]);
  const [expandedSport, setExpandedSport] = useState<string | null>(null);
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);

  function toggleSport(sport: string) {
    setExpandedSport((previous) => (previous === sport ? null : sport));
    setExpandedCountry(null);
  }
  function toggleCountry(country: string) {
    setExpandedCountry((previous) => (previous === country ? null : country));
  }

  if (isLoading) {
    return <p className="text-sm text-text-secondary">Loading competitions…</p>;
  }
  if (isError) {
    return <p className="text-sm text-danger">Failed to load competitions.</p>;
  }
  if (tree.length === 0) {
    return <p className="text-sm text-text-secondary">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-2">
      {tree.map((sportNode) => {
        const isSportExpanded = expandedSport === sportNode.sport;
        const competitionCount = sportNode.countries.reduce(
          (total, country) => total + country.competitions.length,
          0,
        );
        return (
          <Card key={sportNode.sport}>
            <ExpandButton
              isExpanded={isSportExpanded}
              onClick={() => toggleSport(sportNode.sport)}
              label={sportNode.sport}
              count={competitionCount}
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
                        count={countryNode.competitions.length}
                      />
                      {isCountryExpanded && (
                        <div className="space-y-1.5 border-t border-border pl-3 pt-2">
                          {countryNode.competitions.map((leagueNode) => (
                            <div key={leagueNode.competition}>
                              {renderCompetition(leagueNode.competition, countryNode.country, sportNode.sport)}
                            </div>
                          ))}
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
