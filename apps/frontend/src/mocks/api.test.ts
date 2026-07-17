import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchMatchById, fetchMatches } from './api';
import { mockMatches } from './matches';

describe('mock odds api', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves the full match list', async () => {
    const matches = await fetchMatches();
    expect(matches).toEqual(mockMatches);
  });

  it('resolves a single match by id', async () => {
    const firstMatch = mockMatches[0];
    if (!firstMatch) {
      throw new Error('expected mockMatches to be non-empty');
    }

    const match = await fetchMatchById(firstMatch.id);
    expect(match).toEqual(firstMatch);
  });

  it('resolves undefined for an unknown match id', async () => {
    const match = await fetchMatchById('does-not-exist');
    expect(match).toBeUndefined();
  });

  it('simulates network latency before resolving', async () => {
    vi.useFakeTimers();

    let resolved = false;
    void fetchMatches().then(() => {
      resolved = true;
    });

    await vi.advanceTimersByTimeAsync(100);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(400);
    expect(resolved).toBe(true);
  });
});
