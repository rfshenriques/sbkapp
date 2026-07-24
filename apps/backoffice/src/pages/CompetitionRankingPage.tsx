import { useMemo, useState, type DragEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Match } from '@sportsbook/shared';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ChevronIcon } from '../components/ui/ChevronIcon';
import { competitionSportMap } from '../lib/countryMaps';
import { sortSportsByPriority } from '../lib/sportPriority';
import * as backendApi from '../lib/backendApi';
import * as oddsEngineApi from '../lib/oddsEngineApi';

const rankingsQueryKey = ['competition-rankings'] as const;
const matchesQueryKey = ['live-matches'] as const;

/** A ranked competition whose sport can't be resolved from the live feed (e.g. it dropped out of the schedule entirely). */
const UNKNOWN_SPORT = 'Other';

interface SportRankingGroupProps {
  sport: string;
  rankings: backendApi.CompetitionRanking[];
  matches: Match[];
}

/**
 * One sport's own ranked order, entirely independent of every other
 * sport's - Football's competitions are ranked 1..N among themselves,
 * Tennis's are ranked 1..N among themselves, etc. This is what then
 * orders that sport's drill-down in the player app (see
 * buildSportTree.ts), not a single cross-sport ordering - see the CMS
 * Quicklinks tab for curating the separate cross-sport "Top Competitions"
 * sidebar shortcut list.
 */
function SportRankingGroup({ sport, rankings, matches }: SportRankingGroupProps) {
  const queryClient = useQueryClient();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOrder, setDragOrder] = useState<backendApi.CompetitionRanking[] | null>(null);

  const orderedRankings = useMemo(
    () => dragOrder ?? [...rankings].sort((a, b) => a.rank - b.rank),
    [dragOrder, rankings],
  );

  const setRankingMutation = useMutation({
    mutationFn: ({ competition, rank }: { competition: string; rank: number }) =>
      backendApi.setCompetitionRanking(competition, rank),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: rankingsQueryKey });
      setDragOrder(null);
    },
  });

  const removeRankingMutation = useMutation({
    mutationFn: (id: string) => backendApi.removeCompetitionRanking(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: rankingsQueryKey });
      setDragOrder(null);
    },
  });

  const matchCountByCompetition = useMemo(() => {
    const counts = new Map<string, number>();
    for (const match of matches) {
      counts.set(match.competition, (counts.get(match.competition) ?? 0) + 1);
    }
    return counts;
  }, [matches]);

  const unrankedCompetitions = useMemo(() => {
    const ranked = new Set(orderedRankings.map((ranking) => ranking.competition));
    const all = new Set(matches.map((match) => match.competition));
    return [...all].filter((competition) => !ranked.has(competition)).sort((a, b) => a.localeCompare(b));
  }, [matches, orderedRankings]);

  function persistOrder(next: backendApi.CompetitionRanking[]) {
    next.forEach((ranking, index) => {
      const rank = index + 1;
      if (ranking.rank !== rank) {
        setRankingMutation.mutate({ competition: ranking.competition, rank });
      }
    });
  }

  function handleDrop(targetIndex: number) {
    if (!draggedId) return;
    const fromIndex = orderedRankings.findIndex((ranking) => ranking.id === draggedId);
    if (fromIndex === -1 || fromIndex === targetIndex) return;

    const next = [...orderedRankings];
    const moved = next.splice(fromIndex, 1)[0];
    if (!moved) return;
    next.splice(targetIndex, 0, moved);
    setDragOrder(next);
    persistOrder(next);
    setDraggedId(null);
  }

  function handleAdd(competition: string) {
    const nextRank = orderedRankings.length + 1;
    setRankingMutation.mutate({ competition, rank: nextRank });
  }

  function allowDrop(event: DragEvent) {
    event.preventDefault();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="min-w-0">
        <h3 className="mb-2 text-sm font-semibold text-text-secondary">
          Ranked order ({orderedRankings.length})
        </h3>
        {orderedRankings.length === 0 && (
          <p className="text-sm text-text-secondary">
            Nothing ranked yet - add a competition from the list on the right.
          </p>
        )}
        {orderedRankings.length > 0 && (
          <Card className="space-y-1">
            {orderedRankings.map((ranking, index) => {
              const matchCount = matchCountByCompetition.get(ranking.competition) ?? 0;
              return (
                <div
                  key={ranking.id}
                  draggable
                  onDragStart={() => setDraggedId(ranking.id)}
                  onDragOver={allowDrop}
                  onDrop={() => handleDrop(index)}
                  onDragEnd={() => setDraggedId(null)}
                  className={`flex items-center justify-between gap-2 rounded-md bg-background px-3 py-2 ${
                    draggedId === ranking.id ? 'opacity-40' : ''
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="cursor-grab select-none text-text-muted" aria-hidden="true" title="Drag to reorder">
                      ⠿
                    </span>
                    <span className="w-6 shrink-0 text-sm font-semibold text-text-muted">{index + 1}</span>
                    <span className="min-w-0 truncate text-sm">{ranking.competition}</span>
                    {matchCount === 0 && (
                      <span className="shrink-0 rounded-full bg-surface-hover px-2 py-0.5 text-xs text-text-muted">
                        No matches
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => removeRankingMutation.mutate(ranking.id)}
                    disabled={removeRankingMutation.isPending}
                  >
                    Remove
                  </Button>
                </div>
              );
            })}
          </Card>
        )}
      </div>

      <div className="min-w-0">
        <h3 className="mb-2 text-sm font-semibold text-text-secondary">
          Available in {sport} ({unrankedCompetitions.length})
        </h3>
        {unrankedCompetitions.length === 0 && (
          <p className="text-sm text-text-secondary">Every {sport} competition currently in the feed is already ranked.</p>
        )}
        {unrankedCompetitions.length > 0 && (
          <Card className="space-y-1">
            {unrankedCompetitions.map((competition) => (
              <div key={competition} className="flex items-center justify-between gap-2 rounded-md bg-background px-3 py-2">
                <span className="min-w-0 truncate text-sm">{competition}</span>
                <Button variant="secondary" onClick={() => handleAdd(competition)} disabled={setRankingMutation.isPending}>
                  Add to ranking
                </Button>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}

export default function CompetitionRankingPage() {
  const [expandedSport, setExpandedSport] = useState<string | null>(null);

  const { data: matches } = useQuery({ queryKey: matchesQueryKey, queryFn: oddsEngineApi.fetchMatches });
  const {
    data: rankings,
    isPending: rankingsPending,
    isError: rankingsError,
  } = useQuery({ queryKey: rankingsQueryKey, queryFn: backendApi.listCompetitionRankings });

  const bySport = useMemo(() => competitionSportMap(matches ?? []), [matches]);

  const sports = useMemo(() => {
    const fromFeed = new Set((matches ?? []).map((match) => match.sport));
    const fromRankings = new Set((rankings ?? []).map((ranking) => bySport.get(ranking.competition) ?? UNKNOWN_SPORT));
    const names = [...new Set([...fromFeed, ...fromRankings])];
    const known = names.filter((name) => name !== UNKNOWN_SPORT);
    const ordered = sortSportsByPriority(known);
    return names.includes(UNKNOWN_SPORT) ? [...ordered, UNKNOWN_SPORT] : ordered;
  }, [matches, rankings, bySport]);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Competition importance</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Each sport has its own ranked order, independent of every other sport - this is what orders
        that sport's competitions in the player app's sport drill-down. Top of a sport's list is
        shown first. A competition automatically drops out of the player-facing order whenever it
        has no matches, without losing its place here. To curate the separate cross-sport "Top
        Competitions" sidebar shortcut list, use the CMS Quicklinks tab instead.
      </p>

      <div className="mt-4 space-y-2">
        {rankingsPending && <p className="text-sm text-text-secondary">Loading rankings…</p>}
        {rankingsError && <p className="text-sm text-danger">Failed to load competition rankings.</p>}
        {!rankingsPending && sports.length === 0 && (
          <p className="text-sm text-text-secondary">No sports yet - they'll appear here once matches are live.</p>
        )}

        {sports.map((sport) => {
          const isExpanded = expandedSport === sport;
          const sportRankings = (rankings ?? []).filter(
            (ranking) => (bySport.get(ranking.competition) ?? UNKNOWN_SPORT) === sport,
          );
          const sportMatches = (matches ?? []).filter((match) => match.sport === sport);
          return (
            <Card key={sport} className="p-0">
              <button
                type="button"
                aria-expanded={isExpanded}
                onClick={() => setExpandedSport(isExpanded ? null : sport)}
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
              >
                <span className="text-sm font-semibold">
                  {sport} <span className="text-text-muted">({sportRankings.length})</span>
                </span>
                <ChevronIcon className={`h-4 w-4 shrink-0 text-text-muted ${isExpanded ? 'rotate-180' : ''}`} />
              </button>
              {isExpanded && (
                <div className="border-t border-border p-4 pt-3">
                  <SportRankingGroup sport={sport} rankings={sportRankings} matches={sportMatches} />
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
