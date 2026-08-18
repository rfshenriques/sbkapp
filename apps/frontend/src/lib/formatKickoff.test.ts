import { afterEach, describe, expect, it } from 'vitest';
import { useBrandStore } from '../features/brand/brandStore';
import { formatKickoff } from './formatKickoff';

describe('formatKickoff', () => {
  const now = new Date('2026-07-19T10:00:00Z');

  afterEach(() => {
    useBrandStore.setState({ timeFormat: 'H24' });
  });

  // Matches formatKickoff's own default: useBrandStore's timeFormat is
  // 'H24' until a brand's fetch resolves it, so hour12 is explicitly false
  // here too rather than left to the test environment's own locale default.
  function timeStrFor(date: Date): string {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  it('shows "Today" + time for a kickoff later on the same calendar day', () => {
    const kickoff = new Date('2026-07-19T18:30:00Z');
    expect(formatKickoff(kickoff, now)).toBe(`Today · ${timeStrFor(kickoff)}`);
  });

  it('shows "Tomorrow" + time for a kickoff on the next calendar day', () => {
    const kickoff = new Date('2026-07-20T09:00:00Z');
    expect(formatKickoff(kickoff, now)).toBe(`Tomorrow · ${timeStrFor(kickoff)}`);
  });

  it('shows weekday + time for a kickoff within 3 days but not today/tomorrow', () => {
    const kickoff = new Date('2026-07-21T18:30:00Z');
    const formatted = formatKickoff(kickoff, now);
    expect(formatted).toBe(
      `${kickoff.toLocaleDateString(undefined, { weekday: 'short' })} · ${timeStrFor(kickoff)}`,
    );
  });

  it('shows date (no weekday) + time for a kickoff 3+ days away', () => {
    const kickoff = new Date(now.getTime() + 3 * 24 * 60 * 60_000 + 60_000);
    const formatted = formatKickoff(kickoff, now);
    expect(formatted).toBe(
      `${kickoff.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · ${timeStrFor(kickoff)}`,
    );
  });

  it('shows date + time for a kickoff far in the future', () => {
    const kickoff = new Date('2026-08-15T20:00:00Z');
    const formatted = formatKickoff(kickoff, now);
    expect(formatted).toContain('15');
    expect(formatted).not.toMatch(/Mon|Tue|Wed|Thu|Fri|Sat|Sun|Today|Tomorrow/);
  });

  it('uses 24-hour time by default (before a brand resolves H12)', () => {
    const kickoff = new Date('2026-07-19T18:30:00Z');
    expect(formatKickoff(kickoff, now)).toBe(`Today · ${kickoff.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })}`);
  });

  it('switches to 12-hour time once the brand is configured for it', () => {
    useBrandStore.setState({ timeFormat: 'H12' });
    const kickoff = new Date('2026-07-19T18:30:00Z');
    expect(formatKickoff(kickoff, now)).toBe(`Today · ${kickoff.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true })}`);
  });
});
