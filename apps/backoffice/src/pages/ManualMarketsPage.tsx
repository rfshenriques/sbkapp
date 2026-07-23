import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import * as backendApi from '../lib/backendApi';
import * as oddsEngineApi from '../lib/oddsEngineApi';

const manualMarketsQueryKey = ['manual-markets'] as const;
const matchesQueryKey = ['live-matches'] as const;

interface DraftSelection {
  name: string;
  odds: string;
}

function NewMarketForm({ matchId }: { matchId: string }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [selections, setSelections] = useState<DraftSelection[]>([
    { name: '', odds: '' },
    { name: '', odds: '' },
  ]);

  const createMutation = useMutation({
    mutationFn: () =>
      backendApi.createManualMarket(
        matchId,
        name,
        selections
          .filter((selection) => selection.name.trim() !== '' && selection.odds !== '')
          .map((selection) => ({ name: selection.name, odds: Number(selection.odds) })),
      ),
    onSuccess: () => {
      setName('');
      setSelections([
        { name: '', odds: '' },
        { name: '', odds: '' },
      ]);
      void queryClient.invalidateQueries({ queryKey: manualMarketsQueryKey });
    },
  });

  const validSelections = selections.filter(
    (selection) => selection.name.trim() !== '' && Number(selection.odds) > 1,
  );
  const canSubmit = name.trim() !== '' && validSelections.length >= 1;

  function updateSelection(index: number, field: keyof DraftSelection, value: string) {
    setSelections((prev) => prev.map((selection, i) => (i === index ? { ...selection, [field]: value } : selection)));
  }

  return (
    <div className="space-y-2 rounded-md bg-background px-3 py-2">
      <input
        type="text"
        placeholder="Market name"
        aria-label="New market name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text-primary"
      />
      {selections.map((selection, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Selection name"
            aria-label={`New selection ${index + 1} name`}
            value={selection.name}
            onChange={(event) => updateSelection(index, 'name', event.target.value)}
            className="flex-1 rounded-md border border-border bg-surface px-2 py-1 text-sm text-text-primary"
          />
          <input
            type="text"
            inputMode="decimal"
            placeholder="Odds"
            aria-label={`New selection ${index + 1} odds`}
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
        <Button
          variant="primary"
          disabled={!canSubmit || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          Create market
        </Button>
      </div>
    </div>
  );
}

export default function ManualMarketsPage() {
  const queryClient = useQueryClient();
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

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

  function marketsFor(matchId: string) {
    return (manualMarkets ?? []).filter((market) => market.matchId === matchId);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Manual markets</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Create a market that doesn't exist in the odds feed - it appears on this match's page alongside
        the feed's own markets, priced exactly as entered here.
      </p>

      <div className="mt-4 space-y-3">
        {matchesPending && <p className="text-sm text-text-secondary">Loading live matches…</p>}
        {matchesError && <p className="text-sm text-danger">Failed to load live matches.</p>}
        {matches?.length === 0 && <p className="text-sm text-text-secondary">No live matches right now.</p>}

        {matches?.map((match) => {
          const isExpanded = expandedMatchId === match.id;
          const existing = marketsFor(match.id);

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
                {existing.length > 0 && (
                  <span className="rounded bg-highlight/20 px-2 py-0.5 text-xs text-highlight">
                    {existing.length} manual {existing.length === 1 ? 'market' : 'markets'}
                  </span>
                )}
              </div>

              {isExpanded && (
                <div className="mt-3 space-y-3 border-t border-border pt-3">
                  {existing.map((market) => (
                    <div key={market.id} className="rounded-md bg-background px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{market.name}</span>
                        <Button
                          variant="danger"
                          disabled={removeMutation.isPending}
                          onClick={() => removeMutation.mutate(market.id)}
                        >
                          Remove market
                        </Button>
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
                  ))}

                  <NewMarketForm matchId={match.id} />
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
