import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Match, Market } from '@sportsbook/shared';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ChevronIcon } from '../components/ui/ChevronIcon';
import { CompetitionDrilldown } from '../components/CompetitionDrilldown';
import { MatchDrilldown } from '../components/MatchDrilldown';
import { toast, errorMessage } from '../features/toast/toastStore';
import type { CompetitionNode } from '../lib/matchTree';
import * as backendApi from '../lib/backendApi';
import * as oddsEngineApi from '../lib/oddsEngineApi';

const suspensionsQueryKey = ['market-suspensions'] as const;
const competitionSuspensionsQueryKey = ['competition-suspensions'] as const;
const matchesQueryKey = ['live-matches'] as const;

/** Backend convention: an empty marketId/selectionId means the whole match/market. */
const WHOLE_MATCH_MARKER = '';
const WHOLE_MARKET_MARKER = '';

type Tab = 'matches' | 'competitions';

function MarketRow({
  match,
  market,
  suspensions,
  isMutating,
  suspend,
  unsuspend,
}: {
  match: Match;
  market: Market;
  suspensions: backendApi.MarketSuspension[];
  isMutating: boolean;
  suspend: (args: { matchId: string; marketId?: string; selectionId?: string }) => void;
  unsuspend: (id: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  function find(marketId: string, selectionId: string = WHOLE_MARKET_MARKER) {
    return suspensions.find(
      (row) => row.matchId === match.id && row.marketId === marketId && row.selectionId === selectionId,
    );
  }

  const marketSuspension = find(market.id);

  return (
    <div className="rounded-md bg-background px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setIsExpanded((previous) => !previous)}
          className="flex items-center gap-1 text-left text-sm hover:underline"
        >
          <ChevronIcon className={`h-3.5 w-3.5 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          {market.name}
        </button>
        <div className="flex items-center gap-2">
          {marketSuspension && (
            <span className="rounded bg-warning/20 px-2 py-0.5 text-xs text-warning">Suspended</span>
          )}
          <Button
            variant={marketSuspension ? 'secondary' : 'danger'}
            disabled={isMutating}
            onClick={() =>
              marketSuspension
                ? unsuspend(marketSuspension.id)
                : suspend({ matchId: match.id, marketId: market.id })
            }
          >
            {marketSuspension ? 'Unsuspend' : 'Suspend'}
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-2 space-y-1.5 border-t border-border pt-2">
          {market.selections.map((selection) => {
            const selectionSuspension = find(market.id, selection.id);
            return (
              <div key={selection.id} className="flex flex-wrap items-center justify-between gap-2 pl-2 text-sm">
                <span className="text-text-secondary">
                  {selection.name} <span className="text-text-muted">({selection.odds.toFixed(2)})</span>
                </span>
                <div className="flex items-center gap-2">
                  {selectionSuspension && (
                    <span className="rounded bg-warning/20 px-2 py-0.5 text-xs text-warning">Suspended</span>
                  )}
                  <Button
                    variant={selectionSuspension ? 'secondary' : 'danger'}
                    disabled={isMutating || Boolean(marketSuspension)}
                    onClick={() =>
                      selectionSuspension
                        ? unsuspend(selectionSuspension.id)
                        : suspend({ matchId: match.id, marketId: market.id, selectionId: selection.id })
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
}

function MatchRow({
  match,
  suspensions,
  isMutating,
  suspend,
  unsuspend,
}: {
  match: Match;
  suspensions: backendApi.MarketSuspension[];
  isMutating: boolean;
  suspend: (args: { matchId: string; marketId?: string; selectionId?: string }) => void;
  unsuspend: (id: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const matchSuspension = suspensions.find(
    (row) => row.matchId === match.id && row.marketId === WHOLE_MATCH_MARKER,
  );

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setIsExpanded((previous) => !previous)}
          className="flex items-center gap-1 text-left text-sm font-medium hover:underline"
        >
          <ChevronIcon className={`h-4 w-4 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          {match.homeTeam} vs {match.awayTeam}
        </button>
        <div className="flex items-center gap-2">
          {matchSuspension && (
            <span className="rounded bg-warning/20 px-2 py-0.5 text-xs text-warning">Match suspended</span>
          )}
          <Button
            variant={matchSuspension ? 'secondary' : 'danger'}
            disabled={isMutating}
            onClick={() =>
              matchSuspension ? unsuspend(matchSuspension.id) : suspend({ matchId: match.id })
            }
          >
            {matchSuspension ? 'Unsuspend match' : 'Suspend match'}
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          {match.markets.length === 0 && <p className="text-sm text-text-secondary">No markets available yet.</p>}
          {match.markets.map((market) => (
            <MarketRow
              key={market.id}
              match={match}
              market={market}
              suspensions={suspensions}
              isMutating={isMutating}
              suspend={suspend}
              unsuspend={unsuspend}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function MatchSuspensionsSection() {
  const queryClient = useQueryClient();
  const { data: matches, isPending: matchesPending, isError: matchesError } = useQuery({
    queryKey: matchesQueryKey,
    queryFn: oddsEngineApi.fetchMatches,
  });
  const { data: suspensions } = useQuery({
    queryKey: suspensionsQueryKey,
    queryFn: backendApi.listMarketSuspensions,
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: suspensionsQueryKey });
      toast.success('Market suspended');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to suspend market')),
  });
  const unsuspendMutation = useMutation({
    mutationFn: (id: string) => backendApi.unsuspendMarket(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: suspensionsQueryKey });
      toast.success('Market unsuspended');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to unsuspend market')),
  });
  const isMutating = suspendMutation.isPending || unsuspendMutation.isPending;

  return (
    <MatchDrilldown
      matches={matches}
      isLoading={matchesPending}
      isError={matchesError}
      renderLeague={(node: CompetitionNode) => (
        <>
          {node.matches.map((match) => (
            <MatchRow
              key={match.id}
              match={match}
              suspensions={suspensions ?? []}
              isMutating={isMutating}
              suspend={suspendMutation.mutate}
              unsuspend={unsuspendMutation.mutate}
            />
          ))}
        </>
      )}
    />
  );
}

function CompetitionSuspensionRow({ competition }: { competition: string }) {
  const queryClient = useQueryClient();
  const { data: suspensions } = useQuery({
    queryKey: competitionSuspensionsQueryKey,
    queryFn: backendApi.listCompetitionSuspensions,
  });
  const suspension = suspensions?.find((row) => row.competition === competition);

  const suspendMutation = useMutation({
    mutationFn: () => backendApi.suspendCompetition(competition, undefined),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: competitionSuspensionsQueryKey });
      toast.success('Competition suspended');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to suspend competition')),
  });
  const unsuspendMutation = useMutation({
    mutationFn: (id: string) => backendApi.unsuspendCompetition(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: competitionSuspensionsQueryKey });
      toast.success('Competition unsuspended');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to unsuspend competition')),
  });
  const isPending = suspendMutation.isPending || unsuspendMutation.isPending;

  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-background px-3 py-2">
      <span className="min-w-0 truncate text-sm">{competition}</span>
      <div className="flex items-center gap-2">
        {suspension && <span className="rounded bg-warning/20 px-2 py-0.5 text-xs text-warning">Suspended</span>}
        <Button
          variant={suspension ? 'secondary' : 'danger'}
          disabled={isPending}
          onClick={() => (suspension ? unsuspendMutation.mutate(suspension.id) : suspendMutation.mutate())}
        >
          {suspension ? 'Unsuspend' : 'Suspend'}
        </Button>
      </div>
    </div>
  );
}

function CompetitionSuspensionsSection() {
  const { data: matches, isPending, isError } = useQuery({
    queryKey: matchesQueryKey,
    queryFn: oddsEngineApi.fetchMatches,
  });

  return (
    <CompetitionDrilldown
      matches={matches}
      isLoading={isPending}
      isError={isError}
      renderCompetition={(competition) => <CompetitionSuspensionRow competition={competition} />}
    />
  );
}

export default function TradingPage() {
  const [tab, setTab] = useState<Tab>('matches');

  return (
    <div>
      <h1 className="text-2xl font-semibold">Trading suspensions</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Suspend an individual match, market, or selection, or block new bets on a whole competition at
        once - navigate sport &gt; country &gt; {tab === 'matches' ? 'league &gt; match' : 'competition'} to
        find what you're looking for.
      </p>

      <div className="mt-4 flex gap-2">
        <Button variant={tab === 'matches' ? 'primary' : 'secondary'} aria-pressed={tab === 'matches'} onClick={() => setTab('matches')}>
          Matches &amp; markets
        </Button>
        <Button
          variant={tab === 'competitions' ? 'primary' : 'secondary'}
          aria-pressed={tab === 'competitions'}
          onClick={() => setTab('competitions')}
        >
          Whole competitions
        </Button>
      </div>

      <div className="mt-4">
        {tab === 'matches' ? <MatchSuspensionsSection /> : <CompetitionSuspensionsSection />}
      </div>
    </div>
  );
}
