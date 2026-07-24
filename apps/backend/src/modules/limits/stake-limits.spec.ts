import { describe, expect, it } from 'vitest';
import {
  maxStakeFromLiability,
  resolveBetLimit,
  resolveLegLimit,
  type LegContext,
  type PlayerExposure,
  type StakeLimitRow,
} from './stake-limits';

const leg: LegContext = {
  sport: 'Football',
  country: 'England',
  competition: 'Premier League',
  marketName: 'Match Result',
  tier: 1,
};

describe('resolveLegLimit', () => {
  it('returns null for both fields when no rows match', () => {
    expect(resolveLegLimit([], leg)).toEqual({ maxStakeCents: null, maxLiabilityCents: null });
  });

  it('applies a GLOBAL tier-agnostic default when nothing more specific exists', () => {
    const rows: StakeLimitRow[] = [
      { scope: 'GLOBAL', scopeValue: '', tier: 0, maxStakeCents: 100_000, maxLiabilityCents: 500_000 },
    ];
    expect(resolveLegLimit(rows, leg)).toEqual({ maxStakeCents: 100_000, maxLiabilityCents: 500_000 });
  });

  it('a SPORT row overrides the GLOBAL default', () => {
    const rows: StakeLimitRow[] = [
      { scope: 'GLOBAL', scopeValue: '', tier: 0, maxStakeCents: 100_000, maxLiabilityCents: 500_000 },
      { scope: 'SPORT', scopeValue: 'Football', tier: 0, maxStakeCents: 50_000, maxLiabilityCents: null },
    ];
    // maxStakeCents comes from the more specific SPORT row; maxLiabilityCents
    // falls back to GLOBAL since the SPORT row left it null.
    expect(resolveLegLimit(rows, leg)).toEqual({ maxStakeCents: 50_000, maxLiabilityCents: 500_000 });
  });

  it('a MARKET row is more specific than LEAGUE, COUNTRY, and SPORT', () => {
    const rows: StakeLimitRow[] = [
      { scope: 'SPORT', scopeValue: 'Football', tier: 0, maxStakeCents: 50_000, maxLiabilityCents: null },
      { scope: 'COUNTRY', scopeValue: 'England', tier: 0, maxStakeCents: 40_000, maxLiabilityCents: null },
      { scope: 'LEAGUE', scopeValue: 'Premier League', tier: 0, maxStakeCents: 30_000, maxLiabilityCents: null },
      { scope: 'MARKET', scopeValue: 'Match Result', tier: 0, maxStakeCents: 20_000, maxLiabilityCents: null },
    ];
    expect(resolveLegLimit(rows, leg).maxStakeCents).toBe(20_000);
  });

  it('a tier-specific row beats a tier-agnostic row at the same scope', () => {
    const rows: StakeLimitRow[] = [
      { scope: 'SPORT', scopeValue: 'Football', tier: 0, maxStakeCents: 50_000, maxLiabilityCents: null },
      { scope: 'SPORT', scopeValue: 'Football', tier: 1, maxStakeCents: 10_000, maxLiabilityCents: null },
    ];
    expect(resolveLegLimit(rows, leg).maxStakeCents).toBe(10_000);
  });

  it('a tier-specific row for a different tier is ignored', () => {
    const rows: StakeLimitRow[] = [
      { scope: 'SPORT', scopeValue: 'Football', tier: 2, maxStakeCents: 10_000, maxLiabilityCents: null },
      { scope: 'GLOBAL', scopeValue: '', tier: 0, maxStakeCents: 100_000, maxLiabilityCents: null },
    ];
    expect(resolveLegLimit(rows, leg).maxStakeCents).toBe(100_000);
  });

  it('a leg with no assigned tier only ever matches tier-agnostic rows', () => {
    const untiered: LegContext = { ...leg, tier: undefined };
    const rows: StakeLimitRow[] = [
      { scope: 'SPORT', scopeValue: 'Football', tier: 1, maxStakeCents: 10_000, maxLiabilityCents: null },
      { scope: 'SPORT', scopeValue: 'Football', tier: 0, maxStakeCents: 70_000, maxLiabilityCents: null },
    ];
    expect(resolveLegLimit(rows, untiered).maxStakeCents).toBe(70_000);
  });
});

describe('resolveBetLimit', () => {
  it('a single-selection bet resolves to that selection\'s own cap', () => {
    const rows: StakeLimitRow[] = [
      { scope: 'SPORT', scopeValue: 'Football', tier: 0, maxStakeCents: 50_000, maxLiabilityCents: 200_000 },
    ];
    expect(resolveBetLimit(rows, [leg])).toEqual({ maxStakeCents: 50_000, maxLiabilityCents: 200_000 });
  });

  it('an accumulator takes the smallest cap across all legs', () => {
    const legA: LegContext = { ...leg, sport: 'Football' };
    const legB: LegContext = { ...leg, sport: 'Tennis', competition: 'ATP Finals' };
    const rows: StakeLimitRow[] = [
      { scope: 'SPORT', scopeValue: 'Football', tier: 0, maxStakeCents: 100_000, maxLiabilityCents: null },
      { scope: 'SPORT', scopeValue: 'Tennis', tier: 0, maxStakeCents: 40_000, maxLiabilityCents: null },
    ];
    // 1000 EUR vs 400 EUR -> the smaller (400 EUR) governs, per the spec example.
    expect(resolveBetLimit(rows, [legA, legB]).maxStakeCents).toBe(40_000);
  });

  it('a leg with no applicable cap does not drag the bet limit down to zero', () => {
    const legA: LegContext = { ...leg, sport: 'Football' };
    const legB: LegContext = { ...leg, sport: 'Darts', competition: 'World Championship' };
    const rows: StakeLimitRow[] = [
      { scope: 'SPORT', scopeValue: 'Football', tier: 0, maxStakeCents: 100_000, maxLiabilityCents: null },
    ];
    expect(resolveBetLimit(rows, [legA, legB]).maxStakeCents).toBe(100_000);
  });

  it('no cap anywhere means an unlimited bet (null)', () => {
    expect(resolveBetLimit([], [leg, leg])).toEqual({ maxStakeCents: null, maxLiabilityCents: null });
  });

  describe('PLAYER scope override', () => {
    it('a PLAYER row overrides the cascade for that userId', () => {
      const rows: StakeLimitRow[] = [
        { scope: 'GLOBAL', scopeValue: '', tier: 0, maxStakeCents: 100_000, maxLiabilityCents: 500_000 },
        { scope: 'PLAYER', scopeValue: 'user-1', tier: 0, maxStakeCents: 5_000, maxLiabilityCents: 20_000 },
      ];
      const player: PlayerExposure = { userId: 'user-1', existingStakedCents: 0, existingLiabilityCents: 0 };
      expect(resolveBetLimit(rows, [leg], player)).toEqual({ maxStakeCents: 5_000, maxLiabilityCents: 20_000 });
    });

    it('a PLAYER row for a different userId does not apply', () => {
      const rows: StakeLimitRow[] = [
        { scope: 'GLOBAL', scopeValue: '', tier: 0, maxStakeCents: 100_000, maxLiabilityCents: 500_000 },
        { scope: 'PLAYER', scopeValue: 'user-1', tier: 0, maxStakeCents: 5_000, maxLiabilityCents: 20_000 },
      ];
      const player: PlayerExposure = { userId: 'user-2', existingStakedCents: 0, existingLiabilityCents: 0 };
      expect(resolveBetLimit(rows, [leg], player)).toEqual({ maxStakeCents: 100_000, maxLiabilityCents: 500_000 });
    });

    it('a PLAYER row with a null field falls back to the cascade for that field only', () => {
      const rows: StakeLimitRow[] = [
        { scope: 'GLOBAL', scopeValue: '', tier: 0, maxStakeCents: 100_000, maxLiabilityCents: 500_000 },
        { scope: 'PLAYER', scopeValue: 'user-1', tier: 0, maxStakeCents: 5_000, maxLiabilityCents: null },
      ];
      const player: PlayerExposure = { userId: 'user-1', existingStakedCents: 0, existingLiabilityCents: 0 };
      expect(resolveBetLimit(rows, [leg], player)).toEqual({ maxStakeCents: 5_000, maxLiabilityCents: 500_000 });
    });

    it('existing exposure reduces the player\'s effective headroom', () => {
      const rows: StakeLimitRow[] = [
        { scope: 'PLAYER', scopeValue: 'user-1', tier: 0, maxStakeCents: 5_000, maxLiabilityCents: 20_000 },
      ];
      const player: PlayerExposure = { userId: 'user-1', existingStakedCents: 3_000, existingLiabilityCents: 12_000 };
      expect(resolveBetLimit(rows, [leg], player)).toEqual({ maxStakeCents: 2_000, maxLiabilityCents: 8_000 });
    });

    it('existing exposure at or beyond the cap floors headroom at zero, not negative', () => {
      const rows: StakeLimitRow[] = [
        { scope: 'PLAYER', scopeValue: 'user-1', tier: 0, maxStakeCents: 5_000, maxLiabilityCents: 20_000 },
      ];
      const player: PlayerExposure = { userId: 'user-1', existingStakedCents: 9_000, existingLiabilityCents: 25_000 };
      expect(resolveBetLimit(rows, [leg], player)).toEqual({ maxStakeCents: 0, maxLiabilityCents: 0 });
    });

    it('a MARKET-level cap is overridden by the PLAYER row even though MARKET is normally most specific', () => {
      const rows: StakeLimitRow[] = [
        { scope: 'MARKET', scopeValue: 'Match Result', tier: 0, maxStakeCents: 1_000, maxLiabilityCents: 4_000 },
        { scope: 'PLAYER', scopeValue: 'user-1', tier: 0, maxStakeCents: 50_000, maxLiabilityCents: 200_000 },
      ];
      const player: PlayerExposure = { userId: 'user-1', existingStakedCents: 0, existingLiabilityCents: 0 };
      expect(resolveBetLimit(rows, [leg], player)).toEqual({ maxStakeCents: 50_000, maxLiabilityCents: 200_000 });
    });

    it('no PLAYER row for the given player falls back to the ordinary cascade', () => {
      const rows: StakeLimitRow[] = [
        { scope: 'SPORT', scopeValue: 'Football', tier: 0, maxStakeCents: 50_000, maxLiabilityCents: 200_000 },
      ];
      const player: PlayerExposure = { userId: 'user-1', existingStakedCents: 0, existingLiabilityCents: 0 };
      expect(resolveBetLimit(rows, [leg], player)).toEqual({ maxStakeCents: 50_000, maxLiabilityCents: 200_000 });
    });
  });
});

describe('maxStakeFromLiability', () => {
  it('reverses a liability cap into the stake that would produce it, floored', () => {
    // stake * (2.5 - 1) = 1000 -> stake = 666.66 -> floored to 666.
    expect(maxStakeFromLiability(1_000, 2.5)).toBe(666);
  });

  it('an unlimited liability cap (null) means the stake is unconstrained by liability', () => {
    expect(maxStakeFromLiability(null, 2.5)).toBeNull();
  });

  it('combinedOdds of 1 or less never limits the stake (guards div-by-zero)', () => {
    expect(maxStakeFromLiability(1_000, 1)).toBeNull();
    expect(maxStakeFromLiability(1_000, 0.5)).toBeNull();
  });

  it('divides evenly when the liability cap is an exact multiple', () => {
    expect(maxStakeFromLiability(3_000, 4)).toBe(1_000);
  });
});
