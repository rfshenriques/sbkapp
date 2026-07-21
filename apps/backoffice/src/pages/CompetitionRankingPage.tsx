import { useMemo, useState, type DragEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import * as backendApi from '../lib/backendApi';
import * as oddsEngineApi from '../lib/oddsEngineApi';

const rankingsQueryKey = ['competition-rankings'] as const;
const matchesQueryKey = ['live-matches'] as const;

export default function CompetitionRankingPage() {
  const queryClient = useQueryClient();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  // Only set mid-drag, so the row order can move instantly instead of
  // waiting on a round trip - cleared as soon as the drop's mutations
  // settle and the refetched server order takes back over.
  const [dragOrder, setDragOrder] = useState<backendApi.CompetitionRanking[] | null>(null);

  const { data: matches } = useQuery({ queryKey: matchesQueryKey, queryFn: oddsEngineApi.fetchMatches });

  const {
    data: rankings,
    isPending: rankingsPending,
    isError: rankingsError,
  } = useQuery({ queryKey: rankingsQueryKey, queryFn: backendApi.listCompetitionRankings });

  const orderedRankings = useMemo(
    () => dragOrder ?? [...(rankings ?? [])].sort((a, b) => a.rank - b.rank),
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
    for (const match of matches ?? []) {
      counts.set(match.competition, (counts.get(match.competition) ?? 0) + 1);
    }
    return counts;
  }, [matches]);

  // Every competition currently in the feed that isn't part of the ranking
  // yet - "the list of competitions available" to add to the order.
  const unrankedCompetitions = useMemo(() => {
    const ranked = new Set(orderedRankings.map((ranking) => ranking.competition));
    const all = new Set((matches ?? []).map((match) => match.competition));
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
    <div>
      <h1 className="text-2xl font-semibold">Competition importance</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Drag competitions into the order you want them to appear in the player app's "Top
        Competitions" sidebar list - top of the list is shown first. A competition automatically
        drops out of that list on the player side whenever it has no matches, without losing its
        place here.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="min-w-0">
          <h2 className="mb-2 text-sm font-semibold text-text-secondary">
            Ranked order ({orderedRankings.length})
          </h2>
          {rankingsPending && <p className="text-sm text-text-secondary">Loading rankings…</p>}
          {rankingsError && <p className="text-sm text-danger">Failed to load competition rankings.</p>}
          {!rankingsPending && orderedRankings.length === 0 && (
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
                      <span
                        className="cursor-grab select-none text-text-muted"
                        aria-hidden="true"
                        title="Drag to reorder"
                      >
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
          <h2 className="mb-2 text-sm font-semibold text-text-secondary">
            Available competitions ({unrankedCompetitions.length})
          </h2>
          {unrankedCompetitions.length === 0 && (
            <p className="text-sm text-text-secondary">
              {matches && matches.length > 0
                ? 'Every competition currently in the feed is already ranked.'
                : "No competitions yet - they'll appear here once matches are live."}
            </p>
          )}

          {unrankedCompetitions.length > 0 && (
            <Card className="space-y-1">
              {unrankedCompetitions.map((competition) => (
                <div
                  key={competition}
                  className="flex items-center justify-between gap-2 rounded-md bg-background px-3 py-2"
                >
                  <span className="min-w-0 truncate text-sm">{competition}</span>
                  <Button
                    variant="secondary"
                    onClick={() => handleAdd(competition)}
                    disabled={setRankingMutation.isPending}
                  >
                    Add to ranking
                  </Button>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
