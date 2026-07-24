import { describe, expect, it } from 'vitest';
import type { BetSlipSelection } from './betSlipStore';
import { invalidAccumulatorReason } from './accumulatorValidity';

function buildSelection(overrides: Partial<BetSlipSelection> = {}): BetSlipSelection {
  return {
    matchId: 'match-1',
    marketId: 'match-result',
    selectionId: 'home',
    matchLabel: 'Arsenal vs Chelsea',
    marketName: 'Match Result',
    selectionName: 'Home',
    odds: 2.1,
    ...overrides,
  };
}

describe('invalidAccumulatorReason', () => {
  it('is always valid for a single selection, even if it is boosted or singles-only', () => {
    expect(invalidAccumulatorReason([buildSelection({ originalOdds: 1.8, marketSinglesOnly: true })])).toBeNull();
  });

  it('is valid for two unboosted, non-restricted selections', () => {
    const selections = [buildSelection(), buildSelection({ matchId: 'match-2', selectionId: 'away' })];
    expect(invalidAccumulatorReason(selections)).toBeNull();
  });

  it('is valid with exactly one boosted selection among others', () => {
    const selections = [
      buildSelection({ originalOdds: 1.8 }),
      buildSelection({ matchId: 'match-2', selectionId: 'away' }),
    ];
    expect(invalidAccumulatorReason(selections)).toBeNull();
  });

  it('rejects two boosted selections combined', () => {
    const selections = [
      buildSelection({ originalOdds: 1.8 }),
      buildSelection({ matchId: 'match-2', selectionId: 'away', originalOdds: 2.0 }),
    ];
    expect(invalidAccumulatorReason(selections)).toBe(
      'Only one boosted selection can be combined in an accumulator.',
    );
  });

  it('rejects a singles-only market combined with another selection', () => {
    const selections = [
      buildSelection({ marketName: 'Novelty Market', marketSinglesOnly: true }),
      buildSelection({ matchId: 'match-2', selectionId: 'away' }),
    ];
    expect(invalidAccumulatorReason(selections)).toBe(
      'Novelty Market can only be bet as a single, not combined in an accumulator.',
    );
  });
});
