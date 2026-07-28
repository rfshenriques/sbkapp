import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CompetitionDrilldown } from '../components/CompetitionDrilldown';
import { toast, errorMessage } from '../features/toast/toastStore';
import * as backendApi from '../lib/backendApi';
import * as oddsEngineApi from '../lib/oddsEngineApi';

const tiersQueryKey = ['competition-tiers'] as const;
const matchesQueryKey = ['live-matches'] as const;

const TIERS = [1, 2, 3, 4] as const;
/** Matches the <select> value for "no tier assigned" - never sent to the API, only used to trigger a remove. */
const UNTIERED = 'untiered';

function TierRow({ competition, tiers }: { competition: string; tiers: backendApi.CompetitionTier[] }) {
  const queryClient = useQueryClient();
  const tierRow = tiers.find((row) => row.competition === competition);

  const setMutation = useMutation({
    mutationFn: (tier: number) => backendApi.setCompetitionTier(competition, tier),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tiersQueryKey });
      toast.success('Competition tier saved');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to save competition tier')),
  });
  const removeMutation = useMutation({
    mutationFn: (id: string) => backendApi.removeCompetitionTier(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tiersQueryKey });
      toast.success('Competition tier removed');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to remove competition tier')),
  });

  const isPending = setMutation.isPending || removeMutation.isPending;

  function handleChange(value: string) {
    if (value === UNTIERED) {
      if (tierRow) removeMutation.mutate(tierRow.id);
      return;
    }
    setMutation.mutate(Number(value));
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-background px-3 py-2">
      <span className="min-w-0 truncate text-sm">{competition}</span>
      <select
        aria-label={`${competition} tier`}
        value={tierRow ? String(tierRow.tier) : UNTIERED}
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
  const {
    data: matches,
    isPending: matchesPending,
    isError: matchesError,
  } = useQuery({ queryKey: matchesQueryKey, queryFn: oddsEngineApi.fetchMatches });
  const { data: tiers } = useQuery({ queryKey: tiersQueryKey, queryFn: backendApi.listCompetitionTiers });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Competition tiers</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Assign each competition a pricing tier (1-4). Margins page defines how much margin gets
        applied per tier per market - a competition with no tier here never has margin applied to it,
        regardless of what's configured on the Margins page.
      </p>

      <div className="mt-4">
        <CompetitionDrilldown
          matches={matches}
          isLoading={matchesPending}
          isError={matchesError}
          renderCompetition={(competition) => <TierRow competition={competition} tiers={tiers ?? []} />}
        />
      </div>
    </div>
  );
}
