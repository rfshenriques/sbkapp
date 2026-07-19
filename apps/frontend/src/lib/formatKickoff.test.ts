import { describe, expect, it } from 'vitest';
import { formatKickoff } from './formatKickoff';

describe('formatKickoff', () => {
  const now = new Date('2026-07-19T10:00:00Z');

  it('shows weekday + time for a kickoff later today', () => {
    const kickoff = new Date('2026-07-19T18:30:00Z');
    expect(formatKickoff(kickoff, now)).toBe(
      `${kickoff.toLocaleDateString(undefined, { weekday: 'short' })} · ${kickoff.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`,
    );
  });

  it('shows weekday + time for a kickoff just under 3 days away', () => {
    const kickoff = new Date(now.getTime() + 3 * 24 * 60 * 60_000 - 60_000);
    const formatted = formatKickoff(kickoff, now);
    expect(formatted).toContain(kickoff.toLocaleDateString(undefined, { weekday: 'short' }));
    expect(formatted).not.toMatch(/\d{1,2}\s\w{3}/);
  });

  it('shows date (no weekday) + time for a kickoff 3+ days away', () => {
    const kickoff = new Date(now.getTime() + 3 * 24 * 60 * 60_000 + 60_000);
    const formatted = formatKickoff(kickoff, now);
    expect(formatted).toBe(
      `${kickoff.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · ${kickoff.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`,
    );
  });

  it('shows date + time for a kickoff far in the future', () => {
    const kickoff = new Date('2026-08-15T20:00:00Z');
    const formatted = formatKickoff(kickoff, now);
    expect(formatted).toContain('15');
    expect(formatted).not.toMatch(/Mon|Tue|Wed|Thu|Fri|Sat|Sun/);
  });
});
