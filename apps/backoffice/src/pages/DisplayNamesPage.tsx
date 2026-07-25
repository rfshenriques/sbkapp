import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { ChevronIcon } from '../components/ui/ChevronIcon';
import { competitionCountryMap } from '../lib/countryMaps';
import { groupByLetter } from '../lib/groupByLetter';
import * as backendApi from '../lib/backendApi';
import * as oddsEngineApi from '../lib/oddsEngineApi';

const matchesQueryKey = ['live-matches'] as const;
const displayNamesQueryKey = (entityType: backendApi.DisplayNameEntityType) => ['display-names', entityType];

/** A 5th tab alongside the 4 plain entity types - MARKET and SELECTION are edited together here instead of as two separate flat lists, so it's clear which market a selection belongs to. */
const MARKETS_SELECTIONS = 'MARKETS_SELECTIONS' as const;
type TabValue = backendApi.DisplayNameEntityType | typeof MARKETS_SELECTIONS;

const TABS: { value: TabValue; label: string }[] = [
  { value: 'SPORT', label: 'Sports' },
  { value: 'COUNTRY', label: 'Countries' },
  { value: 'COMPETITION', label: 'Competitions' },
  { value: 'TEAM', label: 'Teams' },
  { value: MARKETS_SELECTIONS, label: 'Markets/Selections' },
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
  const [activeType, setActiveType] = useState<TabValue>('COMPETITION');
  const [hasSynced, setHasSynced] = useState(false);
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);
  const [expandedLetter, setExpandedLetter] = useState<string | null>(null);
  const [expandedMarket, setExpandedMarket] = useState<string | null>(null);

  const { data: matches } = useQuery({ queryKey: matchesQueryKey, queryFn: oddsEngineApi.fetchMatches });

  const isMarketsSelections = activeType === MARKETS_SELECTIONS;

  const {
    data: overrides,
    isPending: overridesPending,
    isError: overridesError,
  } = useQuery({
    queryKey: displayNamesQueryKey(activeType as backendApi.DisplayNameEntityType),
    queryFn: () => backendApi.listDisplayNames(activeType as backendApi.DisplayNameEntityType),
    enabled: !isMarketsSelections,
  });

  const { data: marketOverrides, isPending: marketOverridesPending } = useQuery({
    queryKey: displayNamesQueryKey('MARKET'),
    queryFn: () => backendApi.listDisplayNames('MARKET'),
    enabled: isMarketsSelections,
  });
  const { data: selectionOverrides } = useQuery({
    queryKey: displayNamesQueryKey('SELECTION'),
    queryFn: () => backendApi.listDisplayNames('SELECTION'),
    enabled: isMarketsSelections,
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

  const isLetterGrouped = activeType === 'TEAM';
  const letterGroups = useMemo(
    () => (isLetterGrouped && overrides ? groupByLetter(overrides, (override) => override.rawName) : []),
    [isLetterGrouped, overrides],
  );

  /** market name -> the distinct selection names seen under it in the live feed, so an expanded market shows only its own selections instead of every selection ever seen anywhere. */
  const selectionNamesByMarket = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const match of matches ?? []) {
      for (const market of match.markets) {
        const names = map.get(market.name) ?? new Set<string>();
        for (const selection of market.selections) {
          names.add(selection.name);
        }
        map.set(market.name, names);
      }
    }
    return map;
  }, [matches]);
  const selectionOverrideByName = useMemo(
    () => new Map((selectionOverrides ?? []).map((override) => [override.rawName, override])),
    [selectionOverrides],
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
        {TABS.map((tab) => (
          <Button
            key={tab.value}
            variant={activeType === tab.value ? 'primary' : 'secondary'}
            aria-pressed={activeType === tab.value}
            onClick={() => {
              setActiveType(tab.value);
              setExpandedCountry(null);
              setExpandedLetter(null);
              setExpandedMarket(null);
            }}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {!isMarketsSelections && overridesPending && (
          <div className="space-y-2" aria-label="Loading display names" role="status">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        )}
        {!isMarketsSelections && overridesError && (
          <p className="text-sm text-danger">Failed to load display names.</p>
        )}
        {!isMarketsSelections && overrides?.length === 0 && (
          <p className="text-sm text-text-secondary">
            Nothing here yet - they'll appear once matches are live.
          </p>
        )}

        {!isMarketsSelections && overrides && overrides.length > 0 && !isGrouped && !isLetterGrouped && (
          <Card className="space-y-2">
            {overrides.map((override) => (
              <DisplayNameRow key={override.id} override={override} />
            ))}
          </Card>
        )}

        {!isMarketsSelections &&
          isLetterGrouped &&
          letterGroups.map((group) => {
            const isExpanded = expandedLetter === group.key;
            return (
              <Card key={group.key} className="p-0">
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={() => setExpandedLetter(isExpanded ? null : group.key)}
                  className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                >
                  <span className="text-sm font-semibold">
                    {group.label} <span className="text-text-muted">({group.items.length})</span>
                  </span>
                  <ChevronIcon className={`h-4 w-4 shrink-0 text-text-muted ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
                {isExpanded && (
                  <div className="space-y-2 border-t border-border p-4 pt-3">
                    {group.items.map((override) => (
                      <DisplayNameRow key={override.id} override={override} />
                    ))}
                  </div>
                )}
              </Card>
            );
          })}

        {!isMarketsSelections &&
          isGrouped &&
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

        {isMarketsSelections && marketOverridesPending && (
          <div className="space-y-2" aria-label="Loading display names" role="status">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        )}
        {isMarketsSelections && marketOverrides?.length === 0 && (
          <p className="text-sm text-text-secondary">
            Nothing here yet - they'll appear once matches are live.
          </p>
        )}
        {isMarketsSelections &&
          marketOverrides?.map((marketOverride) => {
            const isExpanded = expandedMarket === marketOverride.rawName;
            const selectionNames = [...(selectionNamesByMarket.get(marketOverride.rawName) ?? [])].sort(
              (a, b) => a.localeCompare(b),
            );
            return (
              <Card key={marketOverride.id} className="p-0">
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={() => setExpandedMarket(isExpanded ? null : marketOverride.rawName)}
                  className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                >
                  <span className="text-sm font-semibold">
                    {marketOverride.rawName} <span className="text-text-muted">({selectionNames.length})</span>
                  </span>
                  <ChevronIcon className={`h-4 w-4 shrink-0 text-text-muted ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
                {isExpanded && (
                  <div className="space-y-2 border-t border-border p-4 pt-3">
                    <DisplayNameRow override={marketOverride} />
                    {selectionNames.length === 0 && (
                      <p className="text-sm text-text-secondary">No selections seen for this market yet.</p>
                    )}
                    {selectionNames.map((name) => {
                      const selectionOverride = selectionOverrideByName.get(name);
                      return selectionOverride ? (
                        <DisplayNameRow key={selectionOverride.id} override={selectionOverride} />
                      ) : null;
                    })}
                  </div>
                )}
              </Card>
            );
          })}
      </div>
    </div>
  );
}
