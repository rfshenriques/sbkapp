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

const topNavQueryKey = ['top-nav-items'] as const;
const matchesQueryKey = ['live-matches'] as const;

const KIND_OPTIONS: { kind: backendApi.TopNavItemKind; label: string }[] = [
  { kind: 'SPORT', label: 'Sport' },
  { kind: 'COMPETITION', label: 'Competition' },
  { kind: 'MATCH', label: 'Match' },
  { kind: 'TODAY', label: "Today's matches" },
  { kind: 'TOMORROW', label: "Tomorrow's matches" },
];

/** Empty for TODAY/TOMORROW - the kind label alone ("Today's matches") already says everything, nothing further to target. */
function targetLabel(item: backendApi.TopNavItem, matches: Match[] | undefined): string {
  if (item.kind === 'SPORT') return item.sport ?? '';
  if (item.kind === 'COMPETITION') return item.competition ?? '';
  if (item.kind === 'MATCH') {
    const match = matches?.find((candidate) => candidate.id === item.matchId);
    return match ? `${match.homeTeam} vs ${match.awayTeam}` : (item.matchId ?? '');
  }
  return '';
}

function TopNavItemRow({
  item,
  matches,
  isDragged,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  item: backendApi.TopNavItem;
  matches: Match[] | undefined;
  isDragged: boolean;
  onDragStart: () => void;
  onDragOver: (event: DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}) {
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);
  const [label, setLabel] = useState(item.label);
  const [enabled, setEnabled] = useState(item.enabled);

  const saveMutation = useMutation({
    mutationFn: () => backendApi.updateTopNavItem(item.id, { label, enabled }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: topNavQueryKey });
      toast.success('Top nav item updated');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to update top nav item')),
  });

  const removeMutation = useMutation({
    mutationFn: () => backendApi.removeTopNavItem(item.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: topNavQueryKey });
      toast.success('Top nav item removed');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to remove top nav item')),
  });

  const isDirty = label !== item.label || enabled !== item.enabled;

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
          <span className="block truncate text-sm font-semibold">{item.label}</span>
          <span className="block truncate text-xs text-text-secondary">
            {[
              KIND_OPTIONS.find((option) => option.kind === item.kind)?.label,
              targetLabel(item, matches),
              item.enabled ? 'Enabled' : 'Disabled',
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
      </button>

      {isExpanded && (
        <div className="space-y-3 border-t border-border p-3 pt-3">
          <div>
            <label className="block text-xs text-text-secondary" htmlFor={`label-${item.id}`}>
              Display label
            </label>
            <input
              id={`label-${item.id}`}
              type="text"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
            Enabled
          </label>

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

export default function CmsTopNavPage() {
  const queryClient = useQueryClient();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOrder, setDragOrder] = useState<backendApi.TopNavItem[] | null>(null);
  const [addKind, setAddKind] = useState<backendApi.TopNavItemKind>('SPORT');
  const [selectedSport, setSelectedSport] = useState('');
  const [selectedCompetition, setSelectedCompetition] = useState('');

  const {
    data: items,
    isPending,
    isError,
  } = useQuery({ queryKey: topNavQueryKey, queryFn: backendApi.listTopNavItems });
  const {
    data: matches,
    isPending: matchesPending,
    isError: matchesError,
  } = useQuery({ queryKey: matchesQueryKey, queryFn: oddsEngineApi.fetchMatches });

  const orderedItems = useMemo(
    () => dragOrder ?? [...(items ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [dragOrder, items],
  );

  const sports = useMemo(
    () => Array.from(new Set((matches ?? []).map((match) => match.sport))).sort((a, b) => a.localeCompare(b)),
    [matches],
  );
  const competitions = useMemo(
    () => Array.from(new Set((matches ?? []).map((match) => match.competition))).sort((a, b) => a.localeCompare(b)),
    [matches],
  );
  const featuredMatchIds = new Set(orderedItems.filter((item) => item.kind === 'MATCH').map((item) => item.matchId));
  const hasToday = orderedItems.some((item) => item.kind === 'TODAY');
  const hasTomorrow = orderedItems.some((item) => item.kind === 'TOMORROW');

  const addMutation = useMutation({
    mutationFn: (payload: backendApi.CreateTopNavItemPayload) => backendApi.addTopNavItem(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: topNavQueryKey });
      toast.success('Top nav item added');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to add top nav item')),
  });

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => backendApi.reorderTopNavItems(ids),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: topNavQueryKey });
      setDragOrder(null);
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to reorder top nav items')),
  });

  function allowDrop(event: DragEvent) {
    event.preventDefault();
  }

  function handleDrop(targetIndex: number) {
    if (!draggedId) return;
    const fromIndex = orderedItems.findIndex((item) => item.id === draggedId);
    if (fromIndex === -1 || fromIndex === targetIndex) return;

    const next = [...orderedItems];
    const moved = next.splice(fromIndex, 1)[0];
    if (!moved) return;
    next.splice(targetIndex, 0, moved);
    setDragOrder(next);
    reorderMutation.mutate(next.map((item) => item.id));
    setDraggedId(null);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">CMS: Top nav</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Build the player app's second navbar - a mix of sports, competitions, specific matches, and the two
        auto-updating "Today"/"Tomorrow" timeframe shortcuts, in whatever order you want. It only shows on the
        player app once at least one item here is enabled.
      </p>

      <div className="mt-4 space-y-4">
        {isPending && (
          <div className="space-y-2" aria-label="Loading content" role="status">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        )}
        {isError && <p className="text-sm text-danger">Failed to load top nav items.</p>}
        {!isPending && orderedItems.length === 0 && (
          <p className="text-sm text-text-secondary">No top nav items yet - add one below.</p>
        )}

        {orderedItems.length > 0 && (
          <Card className="space-y-1 p-1">
            {orderedItems.map((item, index) => (
              <TopNavItemRow
                key={item.id}
                item={item}
                matches={matches}
                isDragged={draggedId === item.id}
                onDragStart={() => setDraggedId(item.id)}
                onDragOver={allowDrop}
                onDrop={() => handleDrop(index)}
                onDragEnd={() => setDraggedId(null)}
              />
            ))}
          </Card>
        )}

        <Card>
          <h2 className="mb-2 text-sm font-semibold">Add an item</h2>
          <div className="mb-3 flex flex-wrap gap-2">
            {KIND_OPTIONS.map((option) => (
              <Button
                key={option.kind}
                type="button"
                variant={addKind === option.kind ? 'primary' : 'secondary'}
                onClick={() => setAddKind(option.kind)}
              >
                {option.label}
              </Button>
            ))}
          </div>

          {addKind === 'SPORT' && (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-xs text-text-secondary" htmlFor="add-sport">
                  Sport
                </label>
                <select
                  id="add-sport"
                  value={selectedSport}
                  onChange={(event) => setSelectedSport(event.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
                >
                  <option value="">Select a sport…</option>
                  {sports.map((sport) => (
                    <option key={sport} value={sport}>
                      {sport}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                disabled={!selectedSport || addMutation.isPending}
                onClick={() => {
                  addMutation.mutate({ kind: 'SPORT', label: selectedSport, sport: selectedSport });
                  setSelectedSport('');
                }}
              >
                Add
              </Button>
            </div>
          )}

          {addKind === 'COMPETITION' && (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-xs text-text-secondary" htmlFor="add-competition">
                  Competition
                </label>
                <select
                  id="add-competition"
                  value={selectedCompetition}
                  onChange={(event) => setSelectedCompetition(event.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
                >
                  <option value="">Select a competition…</option>
                  {competitions.map((competition) => (
                    <option key={competition} value={competition}>
                      {competition}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                disabled={!selectedCompetition || addMutation.isPending}
                onClick={() => {
                  addMutation.mutate({
                    kind: 'COMPETITION',
                    label: selectedCompetition,
                    competition: selectedCompetition,
                  });
                  setSelectedCompetition('');
                }}
              >
                Add
              </Button>
            </div>
          )}

          {addKind === 'MATCH' && (
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
                          onClick={() =>
                            addMutation.mutate({
                              kind: 'MATCH',
                              label: `${match.homeTeam} vs ${match.awayTeam}`,
                              matchId: match.id,
                            })
                          }
                        >
                          {isFeatured ? 'Already added' : 'Add to top nav'}
                        </Button>
                      </div>
                    );
                  })}
                </>
              )}
            />
          )}

          {addKind === 'TODAY' && (
            <Button
              disabled={hasToday || addMutation.isPending}
              onClick={() => addMutation.mutate({ kind: 'TODAY', label: "Today's matches" })}
            >
              {hasToday ? 'Already added' : "Add Today's matches"}
            </Button>
          )}

          {addKind === 'TOMORROW' && (
            <Button
              disabled={hasTomorrow || addMutation.isPending}
              onClick={() => addMutation.mutate({ kind: 'TOMORROW', label: "Tomorrow's matches" })}
            >
              {hasTomorrow ? 'Already added' : "Add Tomorrow's matches"}
            </Button>
          )}
        </Card>
      </div>
    </div>
  );
}
