import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import * as backendApi from '../lib/backendApi';
import * as oddsEngineApi from '../lib/oddsEngineApi';

const marginsQueryKey = ['margin-configs'] as const;
const matchesQueryKey = ['live-matches'] as const;

const TIERS = [1, 2, 3, 4] as const;

function MarginCell({
  sport,
  marketName,
  tier,
  existing,
}: {
  sport: string;
  marketName: string;
  tier: number;
  existing: backendApi.MarginConfig | undefined;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(existing ? String(existing.marginPercent) : '');

  const setMutation = useMutation({
    mutationFn: (marginPercent: number) => backendApi.setMarginConfig(sport, marketName, tier, marginPercent),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: marginsQueryKey }),
  });
  const removeMutation = useMutation({
    mutationFn: (id: string) => backendApi.removeMarginConfig(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: marginsQueryKey }),
  });

  const parsed = draft === '' ? null : Number(draft);
  const isValid = draft === '' || (parsed !== null && Number.isFinite(parsed) && parsed >= 0 && parsed <= 100);
  const isDirty = draft !== (existing ? String(existing.marginPercent) : '');
  const isPending = setMutation.isPending || removeMutation.isPending;

  function handleSave() {
    if (!isValid) return;
    if (draft === '') {
      if (existing) removeMutation.mutate(existing.id);
      return;
    }
    setMutation.mutate(parsed as number);
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="text"
        inputMode="decimal"
        aria-label={`${marketName} tier ${tier} margin percent`}
        placeholder="—"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        className="w-16 rounded-md border border-border bg-surface px-2 py-1 text-center text-sm text-text-primary"
      />
      <span className="text-xs text-text-muted">%</span>
      {isDirty && (
        <button
          type="button"
          onClick={handleSave}
          disabled={!isValid || isPending}
          className="rounded-md px-1.5 py-1 text-xs font-medium text-brand hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save
        </button>
      )}
    </div>
  );
}

export default function MarginsPage() {
  const { data: matches } = useQuery({ queryKey: matchesQueryKey, queryFn: oddsEngineApi.fetchMatches });
  const {
    data: margins,
    isPending: marginsPending,
    isError: marginsError,
  } = useQuery({ queryKey: marginsQueryKey, queryFn: backendApi.listMarginConfigs });

  const sports = useMemo(() => {
    const fromFeed = new Set((matches ?? []).map((match) => match.sport));
    const fromMargins = new Set((margins ?? []).map((row) => row.sport));
    return [...new Set([...fromFeed, ...fromMargins])].sort((a, b) => a.localeCompare(b));
  }, [matches, margins]);

  const [activeSport, setActiveSport] = useState<string | null>(null);
  const sport = activeSport && sports.includes(activeSport) ? activeSport : (sports[0] ?? null);

  const marketNames = useMemo(() => {
    if (!sport) return [];
    const fromFeed = new Set(
      (matches ?? [])
        .filter((match) => match.sport === sport)
        .flatMap((match) => match.markets.map((market) => market.name)),
    );
    const fromMargins = new Set((margins ?? []).filter((row) => row.sport === sport).map((row) => row.marketName));
    return [...new Set([...fromFeed, ...fromMargins])].sort((a, b) => a.localeCompare(b));
  }, [matches, margins, sport]);

  const marginByKey = useMemo(() => {
    const map = new Map<string, backendApi.MarginConfig>();
    for (const row of margins ?? []) {
      map.set(`${row.sport}:${row.tier}:${row.marketName}`, row);
    }
    return map;
  }, [margins]);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Margins</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Margin percent applied per market at each pricing tier, separated per sport - the same market
        name (e.g. "Match Result") can carry a different margin for Football than for Tennis at the
        same tier. Only matches whose competition is assigned that tier (see Competition tiers) get
        this margin. A blank cell means no margin is applied for that sport/market/tier.
      </p>

      {sports.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Sport">
          {sports.map((sportName) => (
            <Button
              key={sportName}
              variant={sport === sportName ? 'primary' : 'secondary'}
              aria-pressed={sport === sportName}
              onClick={() => setActiveSport(sportName)}
            >
              {sportName}
            </Button>
          ))}
        </div>
      )}

      <div className="mt-4">
        {marginsPending && <p className="text-sm text-text-secondary">Loading margin configs…</p>}
        {marginsError && <p className="text-sm text-danger">Failed to load margin configs.</p>}
        {!marginsPending && sports.length === 0 && (
          <p className="text-sm text-text-secondary">
            No sports yet - they'll appear here once matches are live.
          </p>
        )}
        {sport && marketNames.length > 0 && (
          // Remounts the whole grid (and every MarginCell's local draft state) on sport switch -
          // otherwise a cell whose (marketName, tier) key is unchanged across sports (e.g. both
          // Football and Tennis have a "Match Result" market) would keep showing the previous
          // sport's draft value instead of the newly selected sport's.
          <Card key={sport} className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-text-secondary">
                  <th className="py-2 pr-4 font-medium">Market</th>
                  {TIERS.map((tier) => (
                    <th key={tier} className="py-2 pr-4 font-medium">
                      Tier {tier}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {marketNames.map((marketName) => (
                  <tr key={marketName} className="border-b border-border last:border-0">
                    <td className="py-2 pr-4">{marketName}</td>
                    {TIERS.map((tier) => (
                      <td key={tier} className="py-2 pr-4">
                        <MarginCell
                          sport={sport}
                          marketName={marketName}
                          tier={tier}
                          existing={marginByKey.get(`${sport}:${tier}:${marketName}`)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}
