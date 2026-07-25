import { describe, expect, it } from 'vitest';
import { isoToLocalInputValue, localInputValueToIso } from './dateTimeInput';

describe('isoToLocalInputValue', () => {
  it('returns an empty string for null/undefined', () => {
    expect(isoToLocalInputValue(null)).toBe('');
    expect(isoToLocalInputValue(undefined)).toBe('');
  });

  it('formats as YYYY-MM-DDTHH:mm, zero-padded', () => {
    const iso = new Date(2026, 2, 5, 9, 7).toISOString();
    expect(isoToLocalInputValue(iso)).toBe('2026-03-05T09:07');
  });
});

describe('localInputValueToIso', () => {
  it('returns null for an empty value', () => {
    expect(localInputValueToIso('')).toBeNull();
  });

  it('round-trips through isoToLocalInputValue unchanged (to the minute)', () => {
    const original = new Date(2026, 7, 21, 20, 0, 0, 0);
    const iso = localInputValueToIso(isoToLocalInputValue(original.toISOString()))!;
    expect(new Date(iso).getTime()).toBe(original.getTime());
  });
});
