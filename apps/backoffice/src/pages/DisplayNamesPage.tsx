import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ChevronIcon } from '../components/ui/ChevronIcon';
import { competitionCountryMap } from '../lib/countryMaps';
import * as backendApi from '../lib/backendApi';
import * as oddsEngineApi from '../lib/oddsEngineApi';

const matchesQueryKey = ['live-matches'] as const;
const displayNamesQueryKey = (entityType: backendApi.DisplayNameEntityType) => ['display-names', entityType];

const ENTITY_TYPES: { value: backendApi.DisplayNameEntityType; label: string }[] = [
  { value: 'SPORT', label: 'Sports' },
  { value: 'COUNTRY', label: 'Countries' },
  { value: 'COMPETITION', label: 'Competitions' },
  { value: 'TEAM', label: 'Teams' },
  { value: 'MARKET', label: 'Markets' },
  { value: 'SELECTION', label: 'Selections' },
];

/** Competitions with no evidence in the currently-loaded match feed. */
const UNKNOWN_COUNTRY = 'Unknown';

interface CountryGroup {
  country: string;
  overrides: backendApi.DisplayNameOverride[];
}

function groupByCountry(
  overrides: backendApi.DisplayNameOverride[],
  byCountry: Map<string, string>,
): CountryGroup[] {
  const map = new Map<string, backendApi.DisplayNameOverride[]>();
  for (const override of overrides) {
    const country = byCountry.get(override.rawName) ?? UNKNOWN_COUNTRY;
    const bucket = map.get(country) ?? [];
    bucket.push(override);
    map.set(country, bucket);
  }
  return Array.from(map.entries())
    .map(([country, bucket]) => ({ country, overrides: bucket }))
    .sort((a, b) => {
      if (a.country === UNKNOWN_COUNTRY) return 1;
      if (b.country === UNKNOWN_COUNTRY) return -1;
      return a.country.localeCompare(b.country);
    });
}

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
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);

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
  // six in one pass rather than re-syncing on every tab switch.
  useEffect(() => {
    if (!matches || matches.length === 0 || hasSynced) {
      return;
    }
    const allMarkets = matches.flatMap((match) => match.markets);
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
    syncMutation.mutate({
      entityType: 'MARKET',
      names: [...new Set(allMarkets.map((market) => market.name))],
    });
    syncMutation.mutate({
      entityType: 'SELECTION',
      names: [...new Set(allMarkets.flatMap((market) => market.selections.map((selection) => selection.name)))],
    });
    setHasSynced(true);
  }, [matches, hasSynced]);

  const isGrouped = activeType === 'COMPETITION';
  const byCountry = useMemo(() => competitionCountryMap(matches ?? []), [matches]);
  const countryGroups = useMemo(
    () => (isGrouped && overrides ? groupByCountry(overrides, byCountry) : []),
    [isGrouped, overrides, byCountry],
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold">Display names</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Sports, countries, competitions, teams, markets, and selections seen in the live odds feed
        are listed here automatically. Set a nicer display name for any raw feed name - e.g. "UEFA
        Champions League Qualification" shown as "Champions League (Q)".
      </p>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Entity type">
        {ENTITY_TYPES.map((entityType) => (
          <Button
            key={entityType.value}
            variant={activeType === entityType.value ? 'primary' : 'secondary'}
            aria-pressed={activeType === entityType.value}
            onClick={() => {
              setActiveType(entityType.value);
              setExpandedCountry(null);
            }}
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

        {overrides && overrides.length > 0 && !isGrouped && (
          <Card className="space-y-2">
            {overrides.map((override) => (
              <DisplayNameRow key={override.id} override={override} />
            ))}
          </Card>
        )}

        {isGrouped &&
          countryGroups.map((group) => {
            const isExpanded = expandedCountry === group.country;
            return (
              <Card key={group.country} className="p-0">
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={() => setExpandedCountry(isExpanded ? null : group.country)}
                  className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                >
                  <span className="text-sm font-semibold">
                    {group.country} <span className="text-text-muted">({group.overrides.length})</span>
                  </span>
                  <ChevronIcon className={`h-4 w-4 shrink-0 text-text-muted ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
                {isExpanded && (
                  <div className="space-y-2 border-t border-border p-4 pt-3">
                    {group.overrides.map((override) => (
                      <DisplayNameRow key={override.id} override={override} />
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
      </div>
    </div>
  );
}
