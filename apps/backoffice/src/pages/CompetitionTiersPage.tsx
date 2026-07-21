import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '../components/ui/Card';
import * as backendApi from '../lib/backendApi';
import * as oddsEngineApi from '../lib/oddsEngineApi';

const tiersQueryKey = ['competition-tiers'] as const;
const matchesQueryKey = ['live-matches'] as const;

const TIERS = [1, 2, 3, 4] as const;
/** Matches the <select> value for "no tier assigned" - never sent to the API, only used to trigger a remove. */
const UNTIERED = 'untiered';

interface Row {
  competition: string;
  tierRow: backendApi.CompetitionTier | undefined;
}

function TierRow({ row }: { row: Row }) {
  const queryClient = useQueryClient();

  const setMutation = useMutation({
    mutationFn: ({ competition, tier }: { competition: string; tier: number }) =>
      backendApi.setCompetitionTier(competition, tier),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: tiersQueryKey }),
  });
  const removeMutation = useMutation({
    mutationFn: (id: string) => backendApi.removeCompetitionTier(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: tiersQueryKey }),
  });

  const isPending = setMutation.isPending || removeMutation.isPending;

  function handleChange(value: string) {
    if (value === UNTIERED) {
      if (row.tierRow) removeMutation.mutate(row.tierRow.id);
      return;
    }
    setMutation.mutate({ competition: row.competition, tier: Number(value) });
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-background px-3 py-2">
      <span className="min-w-0 truncate text-sm">{row.competition}</span>
      <select
        aria-label={`${row.competition} tier`}
        value={row.tierRow ? String(row.tierRow.tier) : UNTIERED}
        disabled={isPending}
        onChange={(event) => handleChange(event.target.value)}
        className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-text-primary"
      >
        <option value={UNTIERED}>No tier</option>
        {TIERS.map((tier) => (
          <option key={tier} value={tier}>
            Tier {tier}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function CompetitionTiersPage() {
  const { data: matches } = useQuery({ queryKey: matchesQueryKey, queryFn: oddsEngineApi.fetchMatches });
  const {
    data: tiers,
    isPending: tiersPending,
    isError: tiersError,
  } = useQuery({ queryKey: tiersQueryKey, queryFn: backendApi.listCompetitionTiers });

  const rows = useMemo(() => {
    const tierByCompetition = new Map((tiers ?? []).map((row) => [row.competition, row]));
    const competitions = new Set<string>([...tierByCompetition.keys(), ...(matches ?? []).map((m) => m.competition)]);
    return [...competitions]
      .sort((a, b) => a.localeCompare(b))
      .map((competition) => ({ competition, tierRow: tierByCompetition.get(competition) }));
  }, [matches, tiers]);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Competition tiers</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Assign each competition a pricing tier (1-4). Margins page defines how much margin gets
        applied per tier per market - a competition with no tier here never has margin applied to it,
        regardless of what's configured on the Margins page.
      </p>

      <div className="mt-4">
        {tiersPending && <p className="text-sm text-text-secondary">Loading competition tiers…</p>}
        {tiersError && <p className="text-sm text-danger">Failed to load competition tiers.</p>}
        {!tiersPending && rows.length === 0 && (
          <p className="text-sm text-text-secondary">
            No competitions yet - they'll appear here once matches are live.
          </p>
        )}
        {rows.length > 0 && (
          <Card className="space-y-2">
            {rows.map((row) => (
              <TierRow key={row.competition} row={row} />
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
