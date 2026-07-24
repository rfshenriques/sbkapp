import { describe, expect, it } from 'vitest';
import { applyMargin, marginConfigKey } from './margin-pricing';

describe('applyMargin', () => {
  it('returns the feed odds unchanged when margin is zero or negative', () => {
    expect(applyMargin(2.0, 0)).toBe(2.0);
    expect(applyMargin(2.0, -5)).toBe(2.0);
  });

  it('adds the margin percentage to implied probability, then converts back to odds', () => {
    // 2.00 -> 50% implied probability. +20 points -> 70% -> 1/0.70 = 1.4286 -> 1.43
    expect(applyMargin(2.0, 20)).toBeCloseTo(1.43, 2);
  });

  it('shortens odds more for already-short (high implied probability) prices', () => {
    // 1.50 -> 66.67% implied. +10 points -> 76.67% -> 1/0.7667 = 1.3043 -> 1.30
    expect(applyMargin(1.5, 10)).toBeCloseTo(1.3, 2);
  });

  it('lengthens the effective payout gap for long-shot prices too, since probability is additive not proportional', () => {
    // 10.00 -> 10% implied. +5 points -> 15% -> 1/0.15 = 6.6667 -> 6.67
    expect(applyMargin(10.0, 5)).toBeCloseTo(6.67, 2);
  });

  it('clamps implied probability at 0.99 so odds never drop to or below 1.00', () => {
    // 1.05 -> ~95.24% implied. +50 points would exceed 100% - clamp to 99%.
    const result = applyMargin(1.05, 50);
    expect(result).toBeGreaterThan(1.0);
    expect(result).toBeCloseTo(1 / 0.99, 2);
  });

  it('rounds to 2 decimal places', () => {
    const result = applyMargin(3.33, 7);
    expect(Number.isInteger(result * 100)).toBe(true);
  });
});

describe('marginConfigKey', () => {
  it('composes a stable key from sport, tier, and market name', () => {
    expect(marginConfigKey('Football', 1, 'Match Result')).toBe('Football:1:Match Result');
    expect(marginConfigKey('Football', 2, 'Match Result')).not.toBe(marginConfigKey('Football', 1, 'Match Result'));
  });

  it('distinguishes the same market/tier across different sports', () => {
    expect(marginConfigKey('Football', 1, 'Match Result')).not.toBe(marginConfigKey('Tennis', 1, 'Match Result'));
  });
});
