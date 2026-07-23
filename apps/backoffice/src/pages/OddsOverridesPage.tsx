import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
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
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: overridesQueryKey }),
  });
  const clearMutation = useMutation({
    mutationFn: (id: string) => backendApi.clearOddsOverride(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: overridesQueryKey }),
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

export default function OddsOverridesPage() {
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [expandedMarketId, setExpandedMarketId] = useState<string | null>(null);

  const {
    data: matches,
    isPending: matchesPending,
    isError: matchesError,
  } = useQuery({ queryKey: matchesQueryKey, queryFn: oddsEngineApi.fetchMatches });

  const { data: overrides } = useQuery({
    queryKey: overridesQueryKey,
    queryFn: backendApi.listOddsOverrides,
  });

  const { data: expandedMatch, isPending: expandedMatchPending } = useQuery({
    queryKey: ['match-detail', expandedMatchId],
    queryFn: () => oddsEngineApi.fetchMatchById(expandedMatchId!),
    enabled: expandedMatchId !== null,
  });

  function findOverride(matchId: string, marketId: string, selectionId: string) {
    return overrides?.find(
      (override) =>
        override.matchId === matchId && override.marketId === marketId && override.selectionId === selectionId,
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Odds management</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Set a fixed price for a specific selection - it replaces whatever the margin pipeline would
        otherwise price that selection at, independent of tier/margin configuration. Clear it to go
        back to the margin-priced feed odds.
      </p>

      <div className="mt-4 space-y-3">
        {matchesPending && <p className="text-sm text-text-secondary">Loading live matches…</p>}
        {matchesError && <p className="text-sm text-danger">Failed to load live matches.</p>}
        {matches?.length === 0 && <p className="text-sm text-text-secondary">No live matches right now.</p>}

        {matches?.map((match) => {
          const isExpanded = expandedMatchId === match.id;

          return (
            <Card key={match.id}>
              <button
                type="button"
                onClick={() => setExpandedMatchId(isExpanded ? null : match.id)}
                className="text-left text-sm font-medium hover:underline"
              >
                {match.homeTeam} vs {match.awayTeam}{' '}
                <span className="text-text-muted">({match.competition})</span>
              </button>

              {isExpanded && (
                <div className="mt-3 space-y-2 border-t border-border pt-3">
                  {expandedMatchPending && <p className="text-sm text-text-secondary">Loading markets…</p>}
                  {expandedMatch?.markets.length === 0 && (
                    <p className="text-sm text-text-secondary">No markets available yet.</p>
                  )}
                  {expandedMatch?.markets.map((market) => {
                    const isMarketExpanded = expandedMarketId === market.id;
                    return (
                      <div key={market.id} className="rounded-md bg-background px-3 py-2">
                        <button
                          type="button"
                          onClick={() => setExpandedMarketId(isMarketExpanded ? null : market.id)}
                          className="text-left text-sm hover:underline"
                        >
                          {market.name}
                        </button>

                        {isMarketExpanded && (
                          <div className="mt-2 space-y-2 border-t border-border pt-2">
                            {market.selections.map((selection) => (
                              <div
                                key={selection.id}
                                className="flex flex-wrap items-center justify-between gap-2 pl-2 text-sm"
                              >
                                <span className="text-text-secondary">{selection.name}</span>
                                <OverrideCell
                                  matchId={match.id}
                                  marketId={market.id}
                                  selectionId={selection.id}
                                  liveOdds={selection.odds}
                                  existing={findOverride(match.id, market.id, selection.id)}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
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
