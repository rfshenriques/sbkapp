import { useMemo, useState, type DragEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Match } from '@sportsbook/shared';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { MatchDrilldown } from '../components/MatchDrilldown';
import { toast, errorMessage } from '../features/toast/toastStore';
import type { CompetitionNode } from '../lib/matchTree';
import * as backendApi from '../lib/backendApi';
import * as oddsEngineApi from '../lib/oddsEngineApi';

const matchOfTheDayQueryKey = ['match-of-the-day'] as const;
const matchesQueryKey = ['live-matches'] as const;

/** `datetime-local` inputs want/give local wall-clock time with no timezone - round-trips through the browser's own offset, same as every other ISO8601 field this app sends the backend. */
function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

function matchLabel(matchId: string, matches: Match[] | undefined): string {
  const match = matches?.find((candidate) => candidate.id === matchId);
  return match ? `${match.homeTeam} vs ${match.awayTeam}` : matchId;
}

function MatchOfTheDayRow({
  entry,
  matches,
  isDragged,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  entry: backendApi.MatchOfTheDayEntry;
  matches: Match[] | undefined;
  isDragged: boolean;
  onDragStart: () => void;
  onDragOver: (event: DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}) {
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);
  const [enabled, setEnabled] = useState(entry.enabled);
  const [startAt, setStartAt] = useState(toDatetimeLocalValue(entry.startAt));
  const [endAt, setEndAt] = useState(toDatetimeLocalValue(entry.endAt));

  const saveMutation = useMutation({
    mutationFn: () =>
      backendApi.updateMatchOfTheDay(entry.id, {
        enabled,
        startAt: fromDatetimeLocalValue(startAt),
        endAt: fromDatetimeLocalValue(endAt),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: matchOfTheDayQueryKey });
      toast.success('Match of the day entry updated');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to update Match of the day entry')),
  });

  const removeMutation = useMutation({
    mutationFn: () => backendApi.removeMatchOfTheDay(entry.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: matchOfTheDayQueryKey });
      toast.success('Match of the day entry removed');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to remove Match of the day entry')),
  });

  const isDirty =
    enabled !== entry.enabled ||
    startAt !== toDatetimeLocalValue(entry.startAt) ||
    endAt !== toDatetimeLocalValue(entry.endAt);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`rounded-md bg-background ${isDragged ? 'opacity-40' : ''}`}
    >
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((value) => !value)}
        className="flex w-full items-center gap-3 px-3 py-2 text-left"
      >
        <span className="cursor-grab select-none text-text-muted" aria-hidden="true" title="Drag to reorder">
          ⠿
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{matchLabel(entry.matchId, matches)}</span>
          <span className="block truncate text-xs text-text-secondary">
            {entry.enabled ? 'Enabled' : 'Disabled'}
            {entry.startAt && ` · from ${new Date(entry.startAt).toLocaleString()}`}
            {entry.endAt && ` · until ${new Date(entry.endAt).toLocaleString()}`}
          </span>
        </span>
      </button>

      {isExpanded && (
        <div className="space-y-3 border-t border-border p-3 pt-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
            Enabled
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-text-secondary" htmlFor={`start-${entry.id}`}>
                Show from (optional)
              </label>
              <input
                id={`start-${entry.id}`}
                type="datetime-local"
                value={startAt}
                onChange={(event) => setStartAt(event.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary" htmlFor={`end-${entry.id}`}>
                Show until (optional)
              </label>
              <input
                id={`end-${entry.id}`}
                type="datetime-local"
                value={endAt}
                onChange={(event) => setEndAt(event.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              disabled={!isDirty || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              Save
            </Button>
            <Button variant="ghost" onClick={() => removeMutation.mutate()} disabled={removeMutation.isPending}>
              Remove
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CmsMatchOfTheDayPage() {
  const queryClient = useQueryClient();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  // Only set mid-drag, so the row order can move instantly instead of
  // waiting on a round trip - cleared once the reorder mutation settles.
  const [dragOrder, setDragOrder] = useState<backendApi.MatchOfTheDayEntry[] | null>(null);

  const {
    data: entries,
    isPending,
    isError,
  } = useQuery({ queryKey: matchOfTheDayQueryKey, queryFn: backendApi.listMatchOfTheDay });
  const {
    data: matches,
    isPending: matchesPending,
    isError: matchesError,
  } = useQuery({ queryKey: matchesQueryKey, queryFn: oddsEngineApi.fetchMatches });

  const orderedEntries = useMemo(
    () => dragOrder ?? [...(entries ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [dragOrder, entries],
  );
  const featuredMatchIds = new Set(orderedEntries.map((entry) => entry.matchId));

  const addMutation = useMutation({
    mutationFn: (matchId: string) => backendApi.addMatchOfTheDay({ matchId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: matchOfTheDayQueryKey });
      toast.success('Match of the day entry added');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to add Match of the day entry')),
  });

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => backendApi.reorderMatchOfTheDay(ids),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: matchOfTheDayQueryKey });
      setDragOrder(null);
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to reorder Match of the day entries')),
  });

  function allowDrop(event: DragEvent) {
    event.preventDefault();
  }

  function handleDrop(targetIndex: number) {
    if (!draggedId) return;
    const fromIndex = orderedEntries.findIndex((entry) => entry.id === draggedId);
    if (fromIndex === -1 || fromIndex === targetIndex) return;

    const next = [...orderedEntries];
    const moved = next.splice(fromIndex, 1)[0];
    if (!moved) return;
    next.splice(targetIndex, 0, moved);
    setDragOrder(next);
    reorderMutation.mutate(next.map((entry) => entry.id));
    setDraggedId(null);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">CMS: Match of the day</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Pick which live match(es) the homepage features as "Match of the day" - it's never chosen
        automatically. With more than one active at once, the homepage shows up to 2 side by side when
        there's room, otherwise cycles through them one at a time. Each pick can optionally be scheduled
        to a start/end window; with neither set, it shows as soon as it's enabled and stays until removed.
      </p>

      <div className="mt-4 space-y-4">
        {isPending && (
          <div className="space-y-2" aria-label="Loading content" role="status">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        )}
        {isError && <p className="text-sm text-danger">Failed to load Match of the day entries.</p>}
        {!isPending && orderedEntries.length === 0 && (
          <p className="text-sm text-text-secondary">No Match of the day entries yet - pick one below.</p>
        )}

        {orderedEntries.length > 0 && (
          <Card className="space-y-1 p-1">
            {orderedEntries.map((entry, index) => (
              <MatchOfTheDayRow
                key={entry.id}
                entry={entry}
                matches={matches}
                isDragged={draggedId === entry.id}
                onDragStart={() => setDraggedId(entry.id)}
                onDragOver={allowDrop}
                onDrop={() => handleDrop(index)}
                onDragEnd={() => setDraggedId(null)}
              />
            ))}
          </Card>
        )}

        <Card>
          <h2 className="mb-2 text-sm font-semibold">Pick a match</h2>
          <MatchDrilldown
            matches={matches}
            isLoading={matchesPending}
            isError={matchesError}
            renderLeague={(node: CompetitionNode) => (
              <>
                {node.matches.map((match) => {
                  const isFeatured = featuredMatchIds.has(match.id);
                  return (
                    <div key={match.id} className="flex items-center justify-between gap-2 py-1 text-sm">
                      <span className="truncate">
                        {match.homeTeam} vs {match.awayTeam}
                      </span>
                      <Button
                        variant="secondary"
                        disabled={isFeatured || addMutation.isPending}
                        onClick={() => addMutation.mutate(match.id)}
                      >
                        {isFeatured ? 'Already featured' : 'Feature as Match of the day'}
                      </Button>
                    </div>
                  );
                })}
              </>
            )}
          />
        </Card>
      </div>
    </div>
  );
}
