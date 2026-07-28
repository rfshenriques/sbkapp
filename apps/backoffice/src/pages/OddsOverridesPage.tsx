import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Match } from '@sportsbook/shared';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { ChevronIcon } from '../components/ui/ChevronIcon';
import { MatchDrilldown } from '../components/MatchDrilldown';
import { toast, errorMessage } from '../features/toast/toastStore';
import type { CompetitionNode } from '../lib/matchTree';
import * as backendApi from '../lib/backendApi';
import * as oddsEngineApi from '../lib/oddsEngineApi';

const overridesQueryKey = ['odds-overrides'] as const;
const matchesQueryKey = ['live-matches'] as const;

function OverrideCell({
  matchId,
  marketId,
  selectionId,
  liveOdds,
  existing,
}: {
  matchId: string;
  marketId: string;
  selectionId: string;
  liveOdds: number;
  existing: backendApi.OddsOverride | undefined;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(existing ? String(existing.oddsValue) : '');

  const setMutation = useMutation({
    mutationFn: (oddsValue: number) =>
      backendApi.setOddsOverride(matchId, marketId, selectionId, oddsValue, undefined),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: overridesQueryKey });
      toast.success('Odds override saved');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to save odds override')),
  });
  const clearMutation = useMutation({
    mutationFn: (id: string) => backendApi.clearOddsOverride(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: overridesQueryKey });
      toast.success('Odds override cleared');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to clear odds override')),
  });

  const parsed = draft === '' ? null : Number(draft);
  const isValid = parsed !== null && Number.isFinite(parsed) && parsed > 1;
  const isDirty = draft !== (existing ? String(existing.oddsValue) : '');
  const isPending = setMutation.isPending || clearMutation.isPending;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-text-muted">Feed {liveOdds.toFixed(2)}</span>
      <input
        type="text"
        inputMode="decimal"
        aria-label={`Fixed price for ${selectionId}`}
        placeholder="—"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        className="w-16 rounded-md border border-border bg-surface px-2 py-1 text-center text-sm text-text-primary"
      />
      {existing && (
        <span className="rounded bg-highlight/20 px-2 py-0.5 text-xs text-highlight">Overridden</span>
      )}
      {isDirty && draft !== '' && (
        <Button
          variant="secondary"
          disabled={!isValid || isPending}
          onClick={() => setMutation.mutate(parsed as number)}
        >
          Set
        </Button>
      )}
      {existing && (
        <Button
          variant="danger"
          disabled={isPending}
          onClick={() => {
            setDraft('');
            clearMutation.mutate(existing.id);
          }}
        >
          Clear
        </Button>
      )}
    </div>
  );
}

function MatchRow({ match, overrides }: { match: Match; overrides: backendApi.OddsOverride[] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { data: expandedMatch, isPending: expandedMatchPending } = useQuery({
    queryKey: ['match-detail', match.id],
    queryFn: () => oddsEngineApi.fetchMatchById(match.id),
    enabled: isExpanded,
  });

  function findOverride(marketId: string, selectionId: string) {
    return overrides.find(
      (override) =>
        override.matchId === match.id && override.marketId === marketId && override.selectionId === selectionId,
    );
  }

  return (
    <Card>
      <button
        type="button"
        onClick={() => setIsExpanded((previous) => !previous)}
        className="flex items-center gap-1 text-left text-sm font-medium hover:underline"
      >
        <ChevronIcon className={`h-4 w-4 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        {match.homeTeam} vs {match.awayTeam}
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          {expandedMatchPending && (
            <div className="space-y-2" aria-label="Loading markets" role="status">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          )}
          {expandedMatch?.markets.length === 0 && (
            <p className="text-sm text-text-secondary">No markets available yet.</p>
          )}
          {expandedMatch?.markets.map((market) => (
            <MarketDisclosure key={market.id} market={market} findOverride={findOverride} matchId={match.id} />
          ))}
        </div>
      )}
    </Card>
  );
}

function MarketDisclosure({
  market,
  findOverride,
  matchId,
}: {
  market: { id: string; name: string; selections: { id: string; name: string; odds: number }[] };
  findOverride: (marketId: string, selectionId: string) => backendApi.OddsOverride | undefined;
  matchId: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <div className="rounded-md bg-background px-3 py-2">
      <button
        type="button"
        onClick={() => setIsExpanded((previous) => !previous)}
        className="text-left text-sm hover:underline"
      >
        {market.name}
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-2 border-t border-border pt-2">
          {market.selections.map((selection) => (
            <div key={selection.id} className="flex flex-wrap items-center justify-between gap-2 pl-2 text-sm">
              <span className="text-text-secondary">{selection.name}</span>
              <OverrideCell
                matchId={matchId}
                marketId={market.id}
                selectionId={selection.id}
                liveOdds={selection.odds}
                existing={findOverride(market.id, selection.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function OddsOverridesPage() {
  const {
    data: matches,
    isPending: matchesPending,
    isError: matchesError,
  } = useQuery({ queryKey: matchesQueryKey, queryFn: oddsEngineApi.fetchMatches });

  const { data: overrides } = useQuery({
    queryKey: overridesQueryKey,
    queryFn: backendApi.listOddsOverrides,
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Odds management</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Set a fixed price for a specific selection - it replaces whatever the margin pipeline would
        otherwise price that selection at, independent of tier/margin configuration. Clear it to go
        back to the margin-priced feed odds. Navigate sport &gt; country &gt; league &gt; match to find
        the selection you're pricing.
      </p>

      <div className="mt-4">
        <MatchDrilldown
          matches={matches}
          isLoading={matchesPending}
          isError={matchesError}
          renderLeague={(node: CompetitionNode) => (
            <>
              {node.matches.map((match) => (
                <MatchRow key={match.id} match={match} overrides={overrides ?? []} />
              ))}
            </>
          )}
        />
      </div>
    </div>
  );
}
