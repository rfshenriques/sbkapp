import { describe, expect, it } from 'vitest';
import { hasInsuranceIneligibleSelection, hasSameEventSelections, invalidAccumulatorReason } from './accumulatorValidity';
import type { BetSlipSelection } from './betSlipStore';

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
  it('is null for fewer than two selections, even a boosted one', () => {
    expect(invalidAccumulatorReason([buildSelection({ originalOdds: 1.8 })])).toBeNull();
  });

  it('rejects two boosted selections combined', () => {
    const reason = invalidAccumulatorReason([
      buildSelection({ matchId: 'match-1', originalOdds: 1.8 }),
      buildSelection({ matchId: 'match-2', originalOdds: 1.9 }),
    ]);
    expect(reason).toContain('Only one boosted selection');
  });

  it('allows one boosted selection alongside an unboosted one', () => {
    const reason = invalidAccumulatorReason([
      buildSelection({ matchId: 'match-1', originalOdds: 1.8 }),
      buildSelection({ matchId: 'match-2' }),
    ]);
    expect(reason).toBeNull();
  });

  it('rejects a singles-only market combined with another selection', () => {
    const reason = invalidAccumulatorReason([
      buildSelection({ matchId: 'match-1', marketName: 'Novelty', marketSinglesOnly: true }),
      buildSelection({ matchId: 'match-2' }),
    ]);
    expect(reason).toBe('Novelty can only be bet as a single, not combined in an accumulator.');
  });

  it('rejects two selections from different markets on the same event', () => {
    const reason = invalidAccumulatorReason([
      buildSelection({ matchId: 'match-1', marketId: 'match-result' }),
      buildSelection({ matchId: 'match-1', marketId: 'total-goals', selectionId: 'over' }),
    ]);
    expect(reason).toContain('same event');
  });

  it('allows two selections on different events', () => {
    const reason = invalidAccumulatorReason([
      buildSelection({ matchId: 'match-1' }),
      buildSelection({ matchId: 'match-2' }),
    ]);
    expect(reason).toBeNull();
  });
});

describe('hasSameEventSelections', () => {
  it('is false when every selection is on a different event', () => {
    expect(
      hasSameEventSelections([buildSelection({ matchId: 'match-1' }), buildSelection({ matchId: 'match-2' })]),
    ).toBe(false);
  });

  it('is true when two selections share a matchId across different markets', () => {
    expect(
      hasSameEventSelections([
        buildSelection({ matchId: 'match-1', marketId: 'match-result' }),
        buildSelection({ matchId: 'match-1', marketId: 'total-goals', selectionId: 'over' }),
      ]),
    ).toBe(true);
  });

  it('is false for a single selection', () => {
    expect(hasSameEventSelections([buildSelection()])).toBe(false);
  });
});

describe('hasInsuranceIneligibleSelection', () => {
  it('is false for an ordinary selection', () => {
    expect(hasInsuranceIneligibleSelection([buildSelection()])).toBe(false);
  });

  it('is true when any selection is boosted', () => {
    expect(hasInsuranceIneligibleSelection([buildSelection(), buildSelection({ originalOdds: 1.8 })])).toBe(true);
  });

  it('is true when any selection belongs to a singles-only market', () => {
    expect(hasInsuranceIneligibleSelection([buildSelection({ marketSinglesOnly: true })])).toBe(true);
  });
});
