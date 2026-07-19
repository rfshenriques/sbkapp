import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import * as backendApi from '../lib/backendApi';
import * as oddsEngineApi from '../lib/oddsEngineApi';

const matchesQueryKey = ['live-matches'] as const;
const displayNamesQueryKey = (entityType: backendApi.DisplayNameEntityType) => ['display-names', entityType];

const ENTITY_TYPES: { value: backendApi.DisplayNameEntityType; label: string }[] = [
  { value: 'SPORT', label: 'Sports' },
  { value: 'COUNTRY', label: 'Countries' },
  { value: 'COMPETITION', label: 'Competitions' },
  { value: 'TEAM', label: 'Teams' },
];

function DisplayNameRow({ override }: { override: backendApi.DisplayNameOverride }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(override.displayName ?? '');

  const setDisplayNameMutation = useMutation({
    mutationFn: (displayName: string | null) => backendApi.setDisplayName(override.id, displayName),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: displayNamesQueryKey(override.entityType) }),
  });

  const isDirty = draft.trim() !== (override.displayName ?? '');

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-background px-3 py-2">
      <span className="text-sm">{override.rawName}</span>
      <div className="flex items-center gap-2">
        <input
          type="text"
          aria-label={`${override.rawName} display name`}
          placeholder={override.rawName}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="w-64 rounded-md border border-border bg-surface px-2 py-1 text-sm text-text-primary"
        />
        <Button
          variant="secondary"
          disabled={!isDirty || setDisplayNameMutation.isPending}
          onClick={() => setDisplayNameMutation.mutate(draft.trim() === '' ? null : draft.trim())}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

export default function DisplayNamesPage() {
  const queryClient = useQueryClient();
  const [activeType, setActiveType] = useState<backendApi.DisplayNameEntityType>('COMPETITION');
  const [hasSynced, setHasSynced] = useState(false);

  const { data: matches } = useQuery({ queryKey: matchesQueryKey, queryFn: oddsEngineApi.fetchMatches });

  const {
    data: overrides,
    isPending: overridesPending,
    isError: overridesError,
  } = useQuery({
    queryKey: displayNamesQueryKey(activeType),
    queryFn: () => backendApi.listDisplayNames(activeType),
  });

  const syncMutation = useMutation({
    mutationFn: ({ entityType, names }: { entityType: backendApi.DisplayNameEntityType; names: string[] }) =>
      backendApi.syncDisplayNames(entityType, names),
    onSuccess: (_data, variables) =>
      void queryClient.invalidateQueries({ queryKey: displayNamesQueryKey(variables.entityType) }),
  });

  // Every entity type is sourced from the same live match feed, so sync all
  // four in one pass rather than re-syncing on every tab switch.
  useEffect(() => {
    if (!matches || matches.length === 0 || hasSynced) {
      return;
    }
    syncMutation.mutate({ entityType: 'SPORT', names: [...new Set(matches.map((match) => match.sport))] });
    syncMutation.mutate({ entityType: 'COUNTRY', names: [...new Set(matches.map((match) => match.country))] });
    syncMutation.mutate({
      entityType: 'COMPETITION',
      names: [...new Set(matches.map((match) => match.competition))],
    });
    syncMutation.mutate({
      entityType: 'TEAM',
      names: [...new Set(matches.flatMap((match) => [match.homeTeam, match.awayTeam]))],
    });
    setHasSynced(true);
  }, [matches, hasSynced]);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Display names</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Sports, countries, competitions, and teams seen in the live odds feed are listed here
        automatically. Set a nicer display name for any raw feed name - e.g. "UEFA Champions League
        Qualification" shown as "UEFA Champions League (Q)".
      </p>

      <div className="mt-4 flex gap-2" role="group" aria-label="Entity type">
        {ENTITY_TYPES.map((entityType) => (
          <Button
            key={entityType.value}
            variant={activeType === entityType.value ? 'primary' : 'secondary'}
            aria-pressed={activeType === entityType.value}
            onClick={() => setActiveType(entityType.value)}
          >
            {entityType.label}
          </Button>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {overridesPending && <p className="text-sm text-text-secondary">Loading display names…</p>}
        {overridesError && <p className="text-sm text-danger">Failed to load display names.</p>}
        {overrides?.length === 0 && (
          <p className="text-sm text-text-secondary">
            Nothing here yet - they'll appear once matches are live.
          </p>
        )}

        {overrides && overrides.length > 0 && (
          <Card className="space-y-2">
            {overrides.map((override) => (
              <DisplayNameRow key={override.id} override={override} />
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
