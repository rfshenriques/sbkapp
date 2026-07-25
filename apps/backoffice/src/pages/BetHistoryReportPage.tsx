import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BetSummaryCard } from '../components/BetSummaryCard';
import * as backendApi from '../lib/backendApi';
import type { BetStatus, ListBetsFilters } from '../lib/backendApi';

const STATUS_FILTERS: Array<BetStatus | 'ALL'> = ['PENDING', 'WON', 'LOST', 'VOID', 'ALL'];

interface FilterState {
  status: BetStatus | 'ALL';
  from: string;
  to: string;
  player: string;
  fundedByFreebets: boolean;
  insured: boolean;
  boosted: boolean;
  hasCampaign: boolean;
  sport: string;
  competition: string;
}

const INITIAL_FILTERS: FilterState = {
  status: 'ALL',
  from: '',
  to: '',
  player: '',
  fundedByFreebets: false,
  insured: false,
  boosted: false,
  hasCampaign: false,
  sport: '',
  competition: '',
};

function toApiFilters(filters: FilterState): ListBetsFilters {
  return {
    status: filters.status === 'ALL' ? undefined : filters.status,
    from: filters.from || undefined,
    to: filters.to || undefined,
    player: filters.player.trim() || undefined,
    fundedByFreebets: filters.fundedByFreebets || undefined,
    insured: filters.insured || undefined,
    boosted: filters.boosted || undefined,
    hasCampaign: filters.hasCampaign || undefined,
    sport: filters.sport || undefined,
    competition: filters.competition || undefined,
  };
}

function ToggleFilter({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

export default function BetHistoryReportPage() {
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);

  const { data: filterOptions } = useQuery({
    queryKey: ['admin-bet-filter-options'],
    queryFn: () => backendApi.getBetFilterOptions(),
  });

  const apiFilters = toApiFilters(filters);
  const {
    data: bets,
    isPending,
    isError,
  } = useQuery({
    queryKey: ['admin-bet-history', apiFilters],
    queryFn: () => backendApi.listBets(apiFilters),
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Bet history</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Every bet placed for this brand, with its current settlement status. For settling open bets, use Trading &gt;
        Bet settlement.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilters((current) => ({ ...current, status }))}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              filters.status === status
                ? 'bg-brand text-slate-950'
                : 'bg-surface text-text-secondary hover:bg-surface-hover'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="bet-history-from" className="block text-xs text-text-secondary">
            From
          </label>
          <input
            id="bet-history-from"
            type="date"
            value={filters.from}
            onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
            className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="bet-history-to" className="block text-xs text-text-secondary">
            To
          </label>
          <input
            id="bet-history-to"
            type="date"
            value={filters.to}
            onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
            className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="min-w-[200px] flex-1">
          <label htmlFor="bet-history-player" className="block text-xs text-text-secondary">
            Player (username or email)
          </label>
          <input
            id="bet-history-player"
            type="text"
            value={filters.player}
            onChange={(event) => setFilters((current) => ({ ...current, player: event.target.value }))}
            placeholder="Search…"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="bet-history-sport" className="block text-xs text-text-secondary">
            Sport
          </label>
          <select
            id="bet-history-sport"
            value={filters.sport}
            onChange={(event) => setFilters((current) => ({ ...current, sport: event.target.value }))}
            className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">All sports</option>
            {filterOptions?.sports.map((sport) => (
              <option key={sport} value={sport}>
                {sport}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="bet-history-competition" className="block text-xs text-text-secondary">
            Competition
          </label>
          <select
            id="bet-history-competition"
            value={filters.competition}
            onChange={(event) => setFilters((current) => ({ ...current, competition: event.target.value }))}
            className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">All competitions</option>
            {filterOptions?.competitions.map((competition) => (
              <option key={competition} value={competition}>
                {competition}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <ToggleFilter
          label="Freebet-funded"
          checked={filters.fundedByFreebets}
          onChange={(checked) => setFilters((current) => ({ ...current, fundedByFreebets: checked }))}
        />
        <ToggleFilter
          label="Insured"
          checked={filters.insured}
          onChange={(checked) => setFilters((current) => ({ ...current, insured: checked }))}
        />
        <ToggleFilter
          label="Boosted"
          checked={filters.boosted}
          onChange={(checked) => setFilters((current) => ({ ...current, boosted: checked }))}
        />
        <ToggleFilter
          label="Campaign-qualified"
          checked={filters.hasCampaign}
          onChange={(checked) => setFilters((current) => ({ ...current, hasCampaign: checked }))}
        />
        <button
          type="button"
          onClick={() => setFilters(INITIAL_FILTERS)}
          className="rounded-md px-3 py-2 text-sm text-text-secondary hover:text-text-primary"
        >
          Reset filters
        </button>
      </div>

      <div className="mt-4 space-y-4">
        {isPending && <p className="text-sm text-text-secondary">Loading bets…</p>}
        {isError && <p className="text-sm text-danger">Failed to load bets.</p>}
        {bets && bets.length === 0 && <p className="text-sm text-text-secondary">No bets match these filters.</p>}

        {bets?.map((bet) => <BetSummaryCard key={bet.id} bet={bet} />)}
      </div>
    </div>
  );
}
