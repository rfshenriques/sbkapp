import { useMemo, useState, type DragEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import * as backendApi from '../../lib/backendApi';
import * as oddsEngineApi from '../../lib/oddsEngineApi';

const quicklinksQueryKey = ['competition-quicklinks'] as const;
const matchesQueryKey = ['live-matches'] as const;

/**
 * Cross-sport curated shortcut list for the player app sidebar's "Top
 * Competitions" section - deliberately separate from the Trading tab's
 * Competition rankings page, which instead orders each sport's own
 * competitions independently for that sport's drill-down. This list can
 * mix competitions from any sport (e.g. EPL, Champions League, ATP
 * Finals) in one hand-picked order.
 */
export function QuicklinksSection() {
  const queryClient = useQueryClient();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOrder, setDragOrder] = useState<backendApi.CompetitionQuicklink[] | null>(null);

  const { data: matches } = useQuery({ queryKey: matchesQueryKey, queryFn: oddsEngineApi.fetchMatches });
  const {
    data: quicklinks,
    isPending: quicklinksPending,
    isError: quicklinksError,
  } = useQuery({ queryKey: quicklinksQueryKey, queryFn: backendApi.listCompetitionQuicklinks });

  const orderedQuicklinks = useMemo(
    () => dragOrder ?? [...(quicklinks ?? [])].sort((a, b) => a.order - b.order),
    [dragOrder, quicklinks],
  );

  const setQuicklinkMutation = useMutation({
    mutationFn: ({ competition, order }: { competition: string; order: number }) =>
      backendApi.setCompetitionQuicklink(competition, order),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: quicklinksQueryKey });
      setDragOrder(null);
    },
  });

  const removeQuicklinkMutation = useMutation({
    mutationFn: (id: string) => backendApi.removeCompetitionQuicklink(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: quicklinksQueryKey });
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

  const availableCompetitions = useMemo(() => {
    const listed = new Set(orderedQuicklinks.map((quicklink) => quicklink.competition));
    const all = new Set((matches ?? []).map((match) => match.competition));
    return [...all].filter((competition) => !listed.has(competition)).sort((a, b) => a.localeCompare(b));
  }, [matches, orderedQuicklinks]);

  function persistOrder(next: backendApi.CompetitionQuicklink[]) {
    next.forEach((quicklink, index) => {
      const order = index + 1;
      if (quicklink.order !== order) {
        setQuicklinkMutation.mutate({ competition: quicklink.competition, order });
      }
    });
  }

  function handleDrop(targetIndex: number) {
    if (!draggedId) return;
    const fromIndex = orderedQuicklinks.findIndex((quicklink) => quicklink.id === draggedId);
    if (fromIndex === -1 || fromIndex === targetIndex) return;

    const next = [...orderedQuicklinks];
    const moved = next.splice(fromIndex, 1)[0];
    if (!moved) return;
    next.splice(targetIndex, 0, moved);
    setDragOrder(next);
    persistOrder(next);
    setDraggedId(null);
  }

  function handleAdd(competition: string) {
    const nextOrder = orderedQuicklinks.length + 1;
    setQuicklinkMutation.mutate({ competition, order: nextOrder });
  }

  function allowDrop(event: DragEvent) {
    event.preventDefault();
  }

  return (
    <div>
      <p className="mb-3 text-sm text-text-secondary">
        A single hand-picked, cross-sport shortcut list shown in the player app sidebar's "Top
        Competitions" section - drag to reorder. This is separate from the Trading tab's Competition
        rankings, which orders each sport's own drill-down independently.
      </p>

      {quicklinksPending && (
        <div className="space-y-2" aria-label="Loading quicklinks" role="status">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      )}
      {quicklinksError && <p className="text-sm text-danger">Failed to load quicklinks.</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="min-w-0">
          <h3 className="mb-2 text-sm font-semibold text-text-secondary">
            Quicklinks order ({orderedQuicklinks.length})
          </h3>
          {!quicklinksPending && orderedQuicklinks.length === 0 && (
            <p className="text-sm text-text-secondary">
              Nothing added yet - add a competition from the list on the right.
            </p>
          )}
          {orderedQuicklinks.length > 0 && (
            <Card className="space-y-1">
              {orderedQuicklinks.map((quicklink, index) => {
                const matchCount = matchCountByCompetition.get(quicklink.competition) ?? 0;
                return (
                  <div
                    key={quicklink.id}
                    draggable
                    onDragStart={() => setDraggedId(quicklink.id)}
                    onDragOver={allowDrop}
                    onDrop={() => handleDrop(index)}
                    onDragEnd={() => setDraggedId(null)}
                    className={`flex items-center justify-between gap-2 rounded-md bg-background px-3 py-2 ${
                      draggedId === quicklink.id ? 'opacity-40' : ''
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="cursor-grab select-none text-text-muted" aria-hidden="true" title="Drag to reorder">
                        ⠿
                      </span>
                      <span className="w-6 shrink-0 text-sm font-semibold text-text-muted">{index + 1}</span>
                      <span className="min-w-0 truncate text-sm">{quicklink.competition}</span>
                      {matchCount === 0 && (
                        <span className="shrink-0 rounded-full bg-surface-hover px-2 py-0.5 text-xs text-text-muted">
                          No matches
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      onClick={() => removeQuicklinkMutation.mutate(quicklink.id)}
                      disabled={removeQuicklinkMutation.isPending}
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
            Available ({availableCompetitions.length})
          </h3>
          {availableCompetitions.length === 0 && (
            <p className="text-sm text-text-secondary">Every competition currently in the feed is already listed.</p>
          )}
          {availableCompetitions.length > 0 && (
            <Card className="space-y-1">
              {availableCompetitions.map((competition) => (
                <div key={competition} className="flex items-center justify-between gap-2 rounded-md bg-background px-3 py-2">
                  <span className="min-w-0 truncate text-sm">{competition}</span>
                  <Button variant="secondary" onClick={() => handleAdd(competition)} disabled={setQuicklinkMutation.isPending}>
                    Add
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
