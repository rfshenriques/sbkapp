import { describe, expect, it } from 'vitest';
import { resolveBetLimit, resolveLegLimit, type LegContext, type StakeLimitRow } from './stake-limits';

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
});
