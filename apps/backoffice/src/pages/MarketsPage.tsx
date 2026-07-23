import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import * as backendApi from '../lib/backendApi';
import * as oddsEngineApi from '../lib/oddsEngineApi';

const suspensionsQueryKey = ['market-suspensions'] as const;
const matchesQueryKey = ['live-matches'] as const;

/** Backend convention: an empty marketId/selectionId means the whole match/market. */
const WHOLE_MATCH_MARKER = '';
const WHOLE_MARKET_MARKER = '';

export default function MarketsPage() {
  const queryClient = useQueryClient();
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [expandedMarketId, setExpandedMarketId] = useState<string | null>(null);

  const {
    data: matches,
    isPending: matchesPending,
    isError: matchesError,
  } = useQuery({ queryKey: matchesQueryKey, queryFn: oddsEngineApi.fetchMatches });

  const { data: suspensions } = useQuery({
    queryKey: suspensionsQueryKey,
    queryFn: backendApi.listMarketSuspensions,
  });

  const { data: expandedMatch, isPending: expandedMatchPending } = useQuery({
    queryKey: ['match-detail', expandedMatchId],
    queryFn: () => oddsEngineApi.fetchMatchById(expandedMatchId!),
    enabled: expandedMatchId !== null,
  });

  const suspendMutation = useMutation({
    mutationFn: ({
      matchId,
      marketId,
      selectionId,
    }: {
      matchId: string;
      marketId?: string;
      selectionId?: string;
    }) => backendApi.suspendMarket(matchId, marketId, selectionId, undefined),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: suspensionsQueryKey }),
  });

  const unsuspendMutation = useMutation({
    mutationFn: (id: string) => backendApi.unsuspendMarket(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: suspensionsQueryKey }),
  });

  function findSuspension(matchId: string, marketId: string, selectionId: string = WHOLE_MARKET_MARKER) {
    return suspensions?.find(
      (suspension) =>
        suspension.matchId === matchId &&
        suspension.marketId === marketId &&
        suspension.selectionId === selectionId,
    );
  }

  const isMutating = suspendMutation.isPending || unsuspendMutation.isPending;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Markets</h1>

      <div className="mt-4 space-y-3">
        {matchesPending && <p className="text-sm text-text-secondary">Loading live matches…</p>}
        {matchesError && <p className="text-sm text-danger">Failed to load live matches.</p>}
        {matches?.length === 0 && (
          <p className="text-sm text-text-secondary">No live matches right now.</p>
        )}

        {matches?.map((match) => {
          const matchSuspension = findSuspension(match.id, WHOLE_MATCH_MARKER);
          const isExpanded = expandedMatchId === match.id;

          return (
            <Card key={match.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setExpandedMatchId(isExpanded ? null : match.id)}
                  className="text-left text-sm font-medium hover:underline"
                >
                  {match.homeTeam} vs {match.awayTeam}{' '}
                  <span className="text-text-muted">({match.competition})</span>
                </button>
                <div className="flex items-center gap-2">
                  {matchSuspension && (
                    <span className="rounded bg-warning/20 px-2 py-0.5 text-xs text-warning">
                      Match suspended
                    </span>
                  )}
                  <Button
                    variant={matchSuspension ? 'secondary' : 'danger'}
                    disabled={isMutating}
                    onClick={() =>
                      matchSuspension
                        ? unsuspendMutation.mutate(matchSuspension.id)
                        : suspendMutation.mutate({ matchId: match.id })
                    }
                  >
                    {matchSuspension ? 'Unsuspend match' : 'Suspend match'}
                  </Button>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-3 space-y-2 border-t border-border pt-3">
                  {expandedMatchPending && (
                    <p className="text-sm text-text-secondary">Loading markets…</p>
                  )}
                  {expandedMatch?.markets.length === 0 && (
                    <p className="text-sm text-text-secondary">No markets available yet.</p>
                  )}
                  {expandedMatch?.markets.map((market) => {
                    const marketSuspension = findSuspension(match.id, market.id);
                    const isMarketExpanded = expandedMarketId === market.id;
                    return (
                      <div key={market.id} className="rounded-md bg-background px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setExpandedMarketId(isMarketExpanded ? null : market.id)}
                            className="text-left text-sm hover:underline"
                          >
                            {market.name}
                          </button>
                          <div className="flex items-center gap-2">
                            {marketSuspension && (
                              <span className="rounded bg-warning/20 px-2 py-0.5 text-xs text-warning">
                                Suspended
                              </span>
                            )}
                            <Button
                              variant={marketSuspension ? 'secondary' : 'danger'}
                              disabled={isMutating}
                              onClick={() =>
                                marketSuspension
                                  ? unsuspendMutation.mutate(marketSuspension.id)
                                  : suspendMutation.mutate({ matchId: match.id, marketId: market.id })
                              }
                            >
                              {marketSuspension ? 'Unsuspend' : 'Suspend'}
                            </Button>
                          </div>
                        </div>

                        {isMarketExpanded && (
                          <div className="mt-2 space-y-1.5 border-t border-border pt-2">
                            {market.selections.map((selection) => {
                              const selectionSuspension = findSuspension(
                                match.id,
                                market.id,
                                selection.id,
                              );
                              return (
                                <div
                                  key={selection.id}
                                  className="flex flex-wrap items-center justify-between gap-2 pl-2 text-sm"
                                >
                                  <span className="text-text-secondary">
                                    {selection.name}{' '}
                                    <span className="text-text-muted">({selection.odds.toFixed(2)})</span>
                                  </span>
                                  <div className="flex items-center gap-2">
                                    {selectionSuspension && (
                                      <span className="rounded bg-warning/20 px-2 py-0.5 text-xs text-warning">
                                        Suspended
                                      </span>
                                    )}
                                    <Button
                                      variant={selectionSuspension ? 'secondary' : 'danger'}
                                      disabled={isMutating || Boolean(marketSuspension)}
                                      onClick={() =>
                                        selectionSuspension
                                          ? unsuspendMutation.mutate(selectionSuspension.id)
                                          : suspendMutation.mutate({
                                              matchId: match.id,
                                              marketId: market.id,
                                              selectionId: selection.id,
                                            })
                                      }
                                    >
                                      {selectionSuspension ? 'Unsuspend' : 'Suspend'}
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
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
