import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useBetSlipStore } from './betSlipStore';

export function BetSlipPanel() {
  const selections = useBetSlipStore((state) => state.selections);
  const removeSelection = useBetSlipStore((state) => state.removeSelection);
  const clear = useBetSlipStore((state) => state.clear);

  if (selections.length === 0) {
    return <p className="text-sm text-text-secondary">Your bet slip is empty.</p>;
  }

  const combinedOdds = selections.reduce((total, selection) => total * selection.odds, 1);

  return (
    <div className="space-y-3">
      {selections.map((selection) => (
        <Card
          key={`${selection.matchId}-${selection.marketId}`}
          className="flex items-start justify-between gap-2"
        >
          <div>
            <p className="text-xs text-text-muted">{selection.matchLabel}</p>
            <p className="text-sm font-medium">
              {selection.marketName}: {selection.selectionName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">{selection.odds.toFixed(2)}</span>
            <button
              type="button"
              aria-label={`Remove ${selection.selectionName} for ${selection.matchLabel}`}
              className="text-text-muted hover:text-danger"
              onClick={() => removeSelection(selection.matchId, selection.marketId)}
            >
              ✕
            </button>
          </div>
        </Card>
      ))}
      <div className="flex items-center justify-between border-t border-border pt-3">
        <span className="text-sm text-text-secondary">
          {selections.length > 1 ? 'Combined odds' : 'Odds'}
        </span>
        <span className="font-semibold">{combinedOdds.toFixed(2)}</span>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={clear} className="flex-1">
          Clear
        </Button>
        <Button variant="primary" disabled className="flex-1">
          Place Bet
        </Button>
      </div>
    </div>
  );
}
