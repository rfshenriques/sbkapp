import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Match } from '@sportsbook/shared';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ChevronIcon } from '../components/ui/ChevronIcon';
import { MatchDrilldown } from '../components/MatchDrilldown';
import type { CompetitionNode } from '../lib/matchTree';
import * as backendApi from '../lib/backendApi';
import * as oddsEngineApi from '../lib/oddsEngineApi';
import { previewBoostedPrice } from '../lib/oddsLadder';

const boostsQueryKey = ['boosts'] as const;
const ladderQueryKey = ['odds-ladder'] as const;
const matchesQueryKey = ['live-matches'] as const;

function BoostCell({
  matchId,
  marketId,
  selectionId,
  feedOdds,
  ladder,
  existing,
}: {
  matchId: string;
  marketId: string;
  selectionId: string;
  feedOdds: number;
  ladder: number[];
  existing: backendApi.Boost | undefined;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(existing ? String(existing.ticks) : '');

  const setMutation = useMutation({
    mutationFn: (ticks: number) => backendApi.setBoost(matchId, marketId, selectionId, ticks, undefined),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: boostsQueryKey }),
  });
  const clearMutation = useMutation({
    mutationFn: (id: string) => backendApi.clearBoost(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: boostsQueryKey }),
  });

  const parsed = draft === '' ? null : Number(draft);
  const isValid = parsed !== null && Number.isInteger(parsed) && parsed >= 1;
  const isDirty = draft !== (existing ? String(existing.ticks) : '');
  const isPending = setMutation.isPending || clearMutation.isPending;
  const preview = isValid ? previewBoostedPrice(ladder, feedOdds, parsed as number) : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-text-muted">Feed {feedOdds.toFixed(2)}</span>
      <input
        type="text"
        inputMode="numeric"
        aria-label={`Ticks for ${selectionId}`}
        placeholder="—"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        className="w-14 rounded-md border border-border bg-surface px-2 py-1 text-center text-sm text-text-primary"
      />
      <span className="text-xs text-text-muted">ticks</span>
      {preview !== null && <span className="text-xs text-highlight">→ {preview.toFixed(2)}</span>}
      {existing && (
        <span className="rounded bg-highlight/20 px-2 py-0.5 text-xs text-highlight">Boosted</span>
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

function MatchRow({
  match,
  boosts,
  ladder,
}: {
  match: Match;
  boosts: backendApi.Boost[];
  ladder: number[];
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { data: expandedMatch, isPending: expandedMatchPending } = useQuery({
    queryKey: ['match-detail', match.id],
    queryFn: () => oddsEngineApi.fetchMatchById(match.id),
    enabled: isExpanded,
  });

  function findBoost(marketId: string, selectionId: string) {
    return boosts.find(
      (boost) => boost.matchId === match.id && boost.marketId === marketId && boost.selectionId === selectionId,
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
          {expandedMatchPending && <p className="text-sm text-text-secondary">Loading markets…</p>}
          {expandedMatch?.markets.length === 0 && (
            <p className="text-sm text-text-secondary">No markets available yet.</p>
          )}
          {expandedMatch?.markets.map((market) => (
            <MarketDisclosure
              key={market.id}
              market={market}
              findBoost={findBoost}
              ladder={ladder}
              matchId={match.id}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function MarketDisclosure({
  market,
  findBoost,
  ladder,
  matchId,
}: {
  market: { id: string; name: string; selections: { id: string; name: string; odds: number }[] };
  findBoost: (marketId: string, selectionId: string) => backendApi.Boost | undefined;
  ladder: number[];
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
              <BoostCell
                matchId={matchId}
                marketId={market.id}
                selectionId={selection.id}
                feedOdds={selection.odds}
                ladder={ladder}
                existing={findBoost(market.id, selection.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BoostsPage() {
  const {
    data: matches,
    isPending: matchesPending,
    isError: matchesError,
  } = useQuery({ queryKey: matchesQueryKey, queryFn: oddsEngineApi.fetchMatches });

  const { data: boosts } = useQuery({ queryKey: boostsQueryKey, queryFn: backendApi.listBoosts });
  const { data: rungs } = useQuery({ queryKey: ladderQueryKey, queryFn: backendApi.listOddsLadderRungs });
  const ladder = (rungs ?? []).map((rung) => rung.value);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Boosts</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Boost a selection by a number of ticks up the odds ladder, relative to whatever price it
        currently shows - never a fixed price. The preview below climbs from the raw feed price shown
        here; the price actually served to players climbs from their fully-priced (margin-adjusted)
        odds instead. Navigate sport &gt; country &gt; league &gt; match to find the selection you're
        boosting.
        {ladder.length === 0 && (
          <span className="text-danger">
            {' '}
            No odds ladder is configured yet - set one up on the Odds ladder page first.
          </span>
        )}
      </p>

      <div className="mt-4">
        <MatchDrilldown
          matches={matches}
          isLoading={matchesPending}
          isError={matchesError}
          renderLeague={(node: CompetitionNode) => (
            <>
              {node.matches.map((match) => (
                <MatchRow key={match.id} match={match} boosts={boosts ?? []} ladder={ladder} />
              ))}
            </>
          )}
        />
      </div>
    </div>
  );
}
