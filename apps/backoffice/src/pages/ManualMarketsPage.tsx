import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Match } from '@sportsbook/shared';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { MatchDrilldown } from '../components/MatchDrilldown';
import type { CompetitionNode } from '../lib/matchTree';
import * as backendApi from '../lib/backendApi';
import * as oddsEngineApi from '../lib/oddsEngineApi';

const manualMarketsQueryKey = ['manual-markets'] as const;
const matchesQueryKey = ['live-matches'] as const;

interface DraftSelection {
  name: string;
  odds: string;
}

function draftFromMarket(market?: backendApi.ManualMarket): DraftSelection[] {
  return market
    ? market.selections.map((selection) => ({ name: selection.name, odds: String(selection.odds) }))
    : [
        { name: '', odds: '' },
        { name: '', odds: '' },
      ];
}

interface MarketFormProps {
  matchId: string;
  /** Present -> editing this existing market in place; absent -> creating a new one. */
  market?: backendApi.ManualMarket;
  /** Called after a successful save when editing, so the caller can close the edit row. */
  onSaved?: () => void;
  onCancel?: () => void;
}

function MarketForm({ matchId, market, onSaved, onCancel }: MarketFormProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(market?.name ?? '');
  const [selections, setSelections] = useState<DraftSelection[]>(draftFromMarket(market));

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = selections
        .filter((selection) => selection.name.trim() !== '' && selection.odds !== '')
        .map((selection) => ({ name: selection.name, odds: Number(selection.odds) }));
      return market
        ? backendApi.updateManualMarket(market.id, name, payload)
        : backendApi.createManualMarket(matchId, name, payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: manualMarketsQueryKey });
      if (market) {
        onSaved?.();
      } else {
        setName('');
        setSelections(draftFromMarket());
      }
    },
  });

  const validSelections = selections.filter(
    (selection) => selection.name.trim() !== '' && Number(selection.odds) > 1,
  );
  const canSubmit = name.trim() !== '' && validSelections.length >= 1;

  function updateSelection(index: number, field: keyof DraftSelection, value: string) {
    setSelections((prev) => prev.map((selection, i) => (i === index ? { ...selection, [field]: value } : selection)));
  }

  const namePrefix = market ? 'Edit' : 'New';

  return (
    <div className="space-y-2 rounded-md bg-background px-3 py-2">
      <input
        type="text"
        placeholder="Market name"
        aria-label={`${namePrefix} market name`}
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text-primary"
      />
      {selections.map((selection, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Selection name"
            aria-label={`${namePrefix} selection ${index + 1} name`}
            value={selection.name}
            onChange={(event) => updateSelection(index, 'name', event.target.value)}
            className="flex-1 rounded-md border border-border bg-surface px-2 py-1 text-sm text-text-primary"
          />
          <input
            type="text"
            inputMode="decimal"
            placeholder="Odds"
            aria-label={`${namePrefix} selection ${index + 1} odds`}
            value={selection.odds}
            onChange={(event) => updateSelection(index, 'odds', event.target.value)}
            className="w-20 rounded-md border border-border bg-surface px-2 py-1 text-center text-sm text-text-primary"
          />
          {selections.length > 1 && (
            <Button
              variant="ghost"
              onClick={() => setSelections((prev) => prev.filter((_, i) => i !== index))}
            >
              Remove selection
            </Button>
          )}
        </div>
      ))}
      <div className="flex items-center gap-2 pt-1">
        <Button variant="secondary" onClick={() => setSelections((prev) => [...prev, { name: '', odds: '' }])}>
          Add selection
        </Button>
        <Button variant="primary" disabled={!canSubmit || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          {market ? 'Save changes' : 'Create market'}
        </Button>
        {market && (
          <Button variant="ghost" disabled={saveMutation.isPending} onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

function MatchRow({
  match,
  manualMarkets,
  removeMutation,
}: {
  match: Match;
  manualMarkets: backendApi.ManualMarket[];
  removeMutation: ReturnType<typeof useMutation<void, Error, string>>;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingMarketId, setEditingMarketId] = useState<string | null>(null);
  const existing = manualMarkets.filter((market) => market.matchId === match.id);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setIsExpanded((previous) => !previous)}
          className="text-left text-sm font-medium hover:underline"
        >
          {match.homeTeam} vs {match.awayTeam}
        </button>
        {existing.length > 0 && (
          <span className="rounded bg-highlight/20 px-2 py-0.5 text-xs text-highlight">
            {existing.length} manual {existing.length === 1 ? 'market' : 'markets'}
          </span>
        )}
      </div>

      {isExpanded && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          {existing.map((market) =>
            editingMarketId === market.id ? (
              <MarketForm
                key={market.id}
                matchId={match.id}
                market={market}
                onSaved={() => setEditingMarketId(null)}
                onCancel={() => setEditingMarketId(null)}
              />
            ) : (
              <div key={market.id} className="rounded-md bg-background px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{market.name}</span>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={() => setEditingMarketId(market.id)}>
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      disabled={removeMutation.isPending}
                      onClick={() => removeMutation.mutate(market.id)}
                    >
                      Remove market
                    </Button>
                  </div>
                </div>
                <div className="mt-1.5 space-y-1 text-sm text-text-secondary">
                  {market.selections.map((selection) => (
                    <div key={selection.id} className="flex items-center justify-between">
                      <span>{selection.name}</span>
                      <span className="text-text-muted">{selection.odds.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ),
          )}

          <MarketForm matchId={match.id} />
        </div>
      )}
    </Card>
  );
}

export default function ManualMarketsPage() {
  const queryClient = useQueryClient();

  const {
    data: matches,
    isPending: matchesPending,
    isError: matchesError,
  } = useQuery({ queryKey: matchesQueryKey, queryFn: oddsEngineApi.fetchMatches });

  const { data: manualMarkets } = useQuery({
    queryKey: manualMarketsQueryKey,
    queryFn: backendApi.listManualMarkets,
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => backendApi.removeManualMarket(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: manualMarketsQueryKey }),
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Manual markets</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Create a market that doesn't exist in the odds feed - it appears on this match's page alongside
        the feed's own markets, priced exactly as entered here. Navigate sport &gt; country &gt; league
        &gt; match to find the match you're adding a market to.
      </p>

      <div className="mt-4">
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
                  manualMarkets={manualMarkets ?? []}
                  removeMutation={removeMutation}
                />
              ))}
            </>
          )}
        />
      </div>
    </div>
  );
}
