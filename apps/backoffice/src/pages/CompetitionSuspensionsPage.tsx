import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import * as backendApi from '../lib/backendApi';
import * as oddsEngineApi from '../lib/oddsEngineApi';

const suspensionsQueryKey = ['competition-suspensions'] as const;
const matchesQueryKey = ['live-matches'] as const;

interface Row {
  competition: string;
  suspension: backendApi.CompetitionSuspension | undefined;
}

function CompetitionRow({ row }: { row: Row }) {
  const queryClient = useQueryClient();

  const suspendMutation = useMutation({
    mutationFn: (competition: string) => backendApi.suspendCompetition(competition, undefined),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: suspensionsQueryKey }),
  });
  const unsuspendMutation = useMutation({
    mutationFn: (id: string) => backendApi.unsuspendCompetition(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: suspensionsQueryKey }),
  });

  const isPending = suspendMutation.isPending || unsuspendMutation.isPending;

  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-background px-3 py-2">
      <span className="min-w-0 truncate text-sm">{row.competition}</span>
      <div className="flex items-center gap-2">
        {row.suspension && (
          <span className="rounded bg-warning/20 px-2 py-0.5 text-xs text-warning">Suspended</span>
        )}
        <Button
          variant={row.suspension ? 'secondary' : 'danger'}
          disabled={isPending}
          onClick={() =>
            row.suspension
              ? unsuspendMutation.mutate(row.suspension.id)
              : suspendMutation.mutate(row.competition)
          }
        >
          {row.suspension ? 'Unsuspend' : 'Suspend'}
        </Button>
      </div>
    </div>
  );
}

export default function CompetitionSuspensionsPage() {
  const { data: matches } = useQuery({ queryKey: matchesQueryKey, queryFn: oddsEngineApi.fetchMatches });
  const {
    data: suspensions,
    isPending: suspensionsPending,
    isError: suspensionsError,
  } = useQuery({ queryKey: suspensionsQueryKey, queryFn: backendApi.listCompetitionSuspensions });

  const rows = useMemo(() => {
    const suspensionByCompetition = new Map((suspensions ?? []).map((row) => [row.competition, row]));
    const competitions = new Set<string>([
      ...suspensionByCompetition.keys(),
      ...(matches ?? []).map((match) => match.competition),
    ]);
    return [...competitions]
      .sort((a, b) => a.localeCompare(b))
      .map((competition) => ({ competition, suspension: suspensionByCompetition.get(competition) }));
  }, [matches, suspensions]);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Competition suspensions</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Suspending a competition blocks new bets on every match within it, immediately - see the
        Suspensions page for suspending a single match, market, or selection instead.
      </p>

      <div className="mt-4">
        {suspensionsPending && <p className="text-sm text-text-secondary">Loading competitions…</p>}
        {suspensionsError && <p className="text-sm text-danger">Failed to load competition suspensions.</p>}
        {!suspensionsPending && rows.length === 0 && (
          <p className="text-sm text-text-secondary">
            No competitions yet - they'll appear here once matches are live.
          </p>
        )}
        {rows.length > 0 && (
          <Card className="space-y-2">
            {rows.map((row) => (
              <CompetitionRow key={row.competition} row={row} />
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
