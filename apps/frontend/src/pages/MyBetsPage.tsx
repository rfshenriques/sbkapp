import { useState } from 'react';
import { BetHistoryList, type BetHistoryFilter } from '../features/bet-history/BetHistoryList';

const FILTERS: { value: BetHistoryFilter; label: string }[] = [
  { value: 'OPEN', label: 'Open' },
  { value: 'WON', label: 'Won' },
  { value: 'FINISHED', label: 'Finished' },
];

export default function MyBetsPage() {
  const [filter, setFilter] = useState<BetHistoryFilter>('OPEN');

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="brand-flag" aria-hidden="true">
          <i></i>
          <i></i>
          <i></i>
        </span>
        <h1 className="font-display text-lg">My Bets</h1>
      </div>

      <div className="mb-3 flex gap-2" role="tablist" aria-label="Bet history filter">
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            className={`tab${filter === value ? ' active' : ''}`}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <BetHistoryList filter={filter} />
    </div>
  );
}
