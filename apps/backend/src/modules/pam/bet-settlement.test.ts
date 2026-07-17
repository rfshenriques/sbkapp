import { describe, expect, it } from 'vitest';
import { computeBetOutcome } from './bet-settlement';

describe('computeBetOutcome', () => {
  it('is PENDING while any selection is still OPEN and none have LOST', () => {
    const outcome = computeBetOutcome(
      [
        { status: 'WON', odds: 2 },
        { status: 'OPEN', odds: 3 },
      ],
      1_000,
    );
    expect(outcome).toEqual({ overallStatus: 'PENDING', payoutCents: 0 });
  });

  it('is LOST as soon as any single selection is LOST, even with others still open', () => {
    const outcome = computeBetOutcome(
      [
        { status: 'LOST', odds: 2 },
        { status: 'OPEN', odds: 3 },
      ],
      1_000,
    );
    expect(outcome).toEqual({ overallStatus: 'LOST', payoutCents: 0 });
  });

  it('a single-selection bet WON pays stake times odds', () => {
    const outcome = computeBetOutcome([{ status: 'WON', odds: 2.1 }], 1_000);
    expect(outcome).toEqual({ overallStatus: 'WON', payoutCents: 2_100 });
  });

  it('a combo of all-WON selections pays stake times the product of every leg', () => {
    const outcome = computeBetOutcome(
      [
        { status: 'WON', odds: 2.1 },
        { status: 'WON', odds: 3.2 },
      ],
      1_000,
    );
    // 2.1 * 3.2 = 6.72
    expect(outcome).toEqual({ overallStatus: 'WON', payoutCents: 6_720 });
  });

  it('a VOID leg counts as 1.00 odds - excluded from the multiplier, not zeroing it out', () => {
    const outcome = computeBetOutcome(
      [
        { status: 'WON', odds: 2.1 },
        { status: 'VOID', odds: 3.2 },
      ],
      1_000,
    );
    expect(outcome).toEqual({ overallStatus: 'WON', payoutCents: 2_100 });
  });

  it('every leg VOID refunds the full stake', () => {
    const outcome = computeBetOutcome(
      [
        { status: 'VOID', odds: 2.1 },
        { status: 'VOID', odds: 3.2 },
      ],
      1_000,
    );
    expect(outcome).toEqual({ overallStatus: 'VOID', payoutCents: 1_000 });
  });

  it('a single VOID selection refunds the stake', () => {
    const outcome = computeBetOutcome([{ status: 'VOID', odds: 2.1 }], 1_000);
    expect(outcome).toEqual({ overallStatus: 'VOID', payoutCents: 1_000 });
  });
});
