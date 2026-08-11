import { describe, expect, it } from 'vitest';
import { isWithinHoursWindow } from './hoursWindow';

describe('isWithinHoursWindow', () => {
  const now = new Date('2026-07-19T12:00:00Z');

  it('"all" always matches, regardless of how far out the kickoff is', () => {
    expect(isWithinHoursWindow('all', new Date('2026-07-19T12:05:00Z'), now)).toBe(true);
    expect(isWithinHoursWindow('all', new Date('2026-12-01T00:00:00Z'), now)).toBe(true);
  });

  it('matches a kickoff inside the window', () => {
    expect(isWithinHoursWindow('3', new Date('2026-07-19T14:00:00Z'), now)).toBe(true);
    expect(isWithinHoursWindow('24', new Date('2026-07-20T11:00:00Z'), now)).toBe(true);
    expect(isWithinHoursWindow('48', new Date('2026-07-21T11:00:00Z'), now)).toBe(true);
  });

  it('excludes a kickoff beyond the window', () => {
    expect(isWithinHoursWindow('3', new Date('2026-07-19T16:00:00Z'), now)).toBe(false);
    expect(isWithinHoursWindow('24', new Date('2026-07-20T13:00:00Z'), now)).toBe(false);
    expect(isWithinHoursWindow('48', new Date('2026-07-21T13:00:00Z'), now)).toBe(false);
  });

  it('is inclusive at the exact boundary', () => {
    expect(isWithinHoursWindow('3', new Date('2026-07-19T15:00:00Z'), now)).toBe(true);
  });

  it('matches an already-started (past) kickoff too - the caller is expected to have already filtered to non-live matches', () => {
    expect(isWithinHoursWindow('24', new Date('2026-07-19T10:00:00Z'), now)).toBe(true);
  });
});
