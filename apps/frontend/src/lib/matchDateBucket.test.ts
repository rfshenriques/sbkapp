import { describe, expect, it } from 'vitest';
import { matchDateBucket } from './matchDateBucket';

describe('matchDateBucket', () => {
  const now = new Date('2026-07-19T10:00:00Z');

  it('buckets a kickoff later the same calendar day as "today"', () => {
    expect(matchDateBucket({ kickoff: '2026-07-19T18:30:00Z', isLive: false }, now)).toBe('today');
  });

  it('buckets a kickoff on the next calendar day as "tomorrow"', () => {
    expect(matchDateBucket({ kickoff: '2026-07-20T09:00:00Z', isLive: false }, now)).toBe('tomorrow');
  });

  it('buckets a kickoff more than a day out as "soon"', () => {
    expect(matchDateBucket({ kickoff: '2026-07-25T09:00:00Z', isLive: false }, now)).toBe('soon');
  });

  it('buckets a kickoff in the past (not live) as "soon"', () => {
    expect(matchDateBucket({ kickoff: '2026-07-10T09:00:00Z', isLive: false }, now)).toBe('soon');
  });

  it('always buckets a live match as "today", whatever its original kickoff was', () => {
    expect(matchDateBucket({ kickoff: '2026-07-10T09:00:00Z', isLive: true }, now)).toBe('today');
  });
});
