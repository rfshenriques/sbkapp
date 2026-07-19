import { BetHistoryList } from '../features/bet-history/BetHistoryList';

export default function MyBetsPage() {
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

      <BetHistoryList />
    </div>
  );
}
