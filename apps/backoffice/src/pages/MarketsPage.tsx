import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import * as backendApi from '../lib/backendApi';
import * as oddsEngineApi from '../lib/oddsEngineApi';

const suspensionsQueryKey = ['market-suspensions'] as const;
const matchesQueryKey = ['live-matches'] as const;

/** Backend convention: an empty marketId on a suspension means the whole match. */
const WHOLE_MATCH_MARKER = '';

export default function MarketsPage() {
  const queryClient = useQueryClient();
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

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
    mutationFn: ({ matchId, marketId }: { matchId: string; marketId?: string }) =>
      backendApi.suspendMarket(matchId, marketId, undefined),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: suspensionsQueryKey }),
  });

  const unsuspendMutation = useMutation({
    mutationFn: (id: string) => backendApi.unsuspendMarket(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: suspensionsQueryKey }),
  });

  function findSuspension(matchId: string, marketId: string) {
    return suspensions?.find(
      (suspension) => suspension.matchId === matchId && suspension.marketId === marketId,
    );
  }

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
                    disabled={suspendMutation.isPending || unsuspendMutation.isPending}
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
                    return (
                      <div
                        key={market.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-background px-3 py-2"
                      >
                        <span className="text-sm">{market.name}</span>
                        <div className="flex items-center gap-2">
                          {marketSuspension && (
                            <span className="rounded bg-warning/20 px-2 py-0.5 text-xs text-warning">
                              Suspended
                            </span>
                          )}
                          <Button
                            variant={marketSuspension ? 'secondary' : 'danger'}
                            disabled={suspendMutation.isPending || unsuspendMutation.isPending}
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
