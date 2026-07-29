import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { centsToDisplay, displayToCents } from './campaignFormatters';

export interface RewardTierEntry {
  rankFrom: number;
  rankTo: number;
  rewardAmountCents: number;
}

interface LeaderboardRewardTierEditorProps {
  idPrefix: string;
  tiers: RewardTierEntry[];
  onSave: (tiers: RewardTierEntry[]) => void;
  isSaving: boolean;
}

/** Rank-range -> flat freebet reward table. Small, rarely-edited list (typically 3-5 rows), so it follows StakeLimitsPage's add-a-row + table pattern rather than CampaignScopeEditor's chip-picker - always sends the full replacement list on save, same "whole set" convention as setScopes. */
export function LeaderboardRewardTierEditor({ idPrefix, tiers, onSave, isSaving }: LeaderboardRewardTierEditorProps) {
  const [rankFrom, setRankFrom] = useState('1');
  const [rankTo, setRankTo] = useState('1');
  const [rewardAmount, setRewardAmount] = useState('10.00');

  const sorted = [...tiers].sort((a, b) => a.rankFrom - b.rankFrom);

  function addRow() {
    const from = Number(rankFrom);
    const to = Number(rankTo);
    const cents = displayToCents(rewardAmount);
    if (!Number.isFinite(from) || !Number.isFinite(to) || from < 1 || to < from || !Number.isFinite(cents) || cents <= 0) {
      return;
    }
    onSave([...tiers, { rankFrom: from, rankTo: to, rewardAmountCents: cents }]);
    setRankFrom(String(to + 1));
    setRankTo(String(to + 1));
  }

  function removeRow(index: number) {
    onSave(sorted.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <span className="block text-xs text-text-secondary">
        Reward tiers - a flat freebet granted per rank range once the leaderboard ends (see "Finalize & grant prizes"
        below). Ranks with no tier get nothing.
      </span>

      {sorted.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-text-secondary">
              <th className="pb-1">Rank</th>
              <th className="pb-1">Reward</th>
              <th className="pb-1" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((tier, index) => (
              <tr key={`${tier.rankFrom}-${tier.rankTo}`} className="border-t border-border">
                <td className="py-1.5">{tier.rankFrom === tier.rankTo ? `#${tier.rankFrom}` : `#${tier.rankFrom}-${tier.rankTo}`}</td>
                <td className="py-1.5">£{centsToDisplay(tier.rewardAmountCents)}</td>
                <td className="py-1.5 text-right">
                  <button
                    type="button"
                    aria-label={`Remove tier ${tier.rankFrom}-${tier.rankTo}`}
                    onClick={() => removeRow(index)}
                    disabled={isSaving}
                    className="text-text-muted hover:text-danger"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {sorted.length === 0 && <p className="text-sm text-text-secondary">No reward tiers yet - ranking is purely informational until one is added.</p>}

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex items-center gap-1.5 text-xs text-text-secondary">
          From rank
          <input
            type="text"
            inputMode="numeric"
            value={rankFrom}
            onChange={(event) => setRankFrom(event.target.value)}
            aria-label={`new tier rank from ${idPrefix}`}
            className="w-16 rounded-md border border-border bg-background px-2 py-1 text-sm"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-text-secondary">
          To rank
          <input
            type="text"
            inputMode="numeric"
            value={rankTo}
            onChange={(event) => setRankTo(event.target.value)}
            aria-label={`new tier rank to ${idPrefix}`}
            className="w-16 rounded-md border border-border bg-background px-2 py-1 text-sm"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-text-secondary">
          Reward (£)
          <input
            type="text"
            inputMode="decimal"
            value={rewardAmount}
            onChange={(event) => setRewardAmount(event.target.value)}
            aria-label={`new tier reward ${idPrefix}`}
            className="w-24 rounded-md border border-border bg-background px-2 py-1 text-sm"
          />
        </label>
        <Button variant="secondary" disabled={isSaving} onClick={addRow}>
          Add tier
        </Button>
      </div>
    </div>
  );
}
