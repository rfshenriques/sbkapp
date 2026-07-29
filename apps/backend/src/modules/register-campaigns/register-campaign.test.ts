import { describe, expect, it } from 'vitest';
import { isWithinQualifyingBetWindow } from './register-campaign';

describe('isWithinQualifyingBetWindow', () => {
  const signedUpAt = new Date('2026-01-01T00:00:00Z');

  it('is true immediately after signup', () => {
    expect(isWithinQualifyingBetWindow(signedUpAt, 7, new Date('2026-01-01T00:00:01Z'))).toBe(true);
  });

  it('is true right up to and including the deadline instant', () => {
    const deadline = new Date('2026-01-08T00:00:00Z');
    expect(isWithinQualifyingBetWindow(signedUpAt, 7, deadline)).toBe(true);
  });

  it('is false the instant after the deadline', () => {
    const afterDeadline = new Date('2026-01-08T00:00:01Z');
    expect(isWithinQualifyingBetWindow(signedUpAt, 7, afterDeadline)).toBe(false);
  });

  it('is false well after the window has closed', () => {
    expect(isWithinQualifyingBetWindow(signedUpAt, 3, new Date('2026-02-01T00:00:00Z'))).toBe(false);
  });

  it('a 0-day window only ever qualifies at the exact signup instant', () => {
    expect(isWithinQualifyingBetWindow(signedUpAt, 0, signedUpAt)).toBe(true);
    expect(isWithinQualifyingBetWindow(signedUpAt, 0, new Date('2026-01-01T00:00:01Z'))).toBe(false);
  });
});
