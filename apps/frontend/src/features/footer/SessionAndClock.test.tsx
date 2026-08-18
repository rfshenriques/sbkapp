import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../auth/authStore';
import { SessionAndClock } from './SessionAndClock';

beforeEach(() => {
  useAuthStore.setState({ sessionStartedAt: null });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SessionAndClock', () => {
  it('shows only the current time for a guest (no session in progress)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-18T14:05:09Z'));

    render(<SessionAndClock />);

    expect(screen.queryByText(/Session/)).not.toBeInTheDocument();
    expect(screen.getByText('Current time')).toBeInTheDocument();
  });

  it("shows the session's elapsed duration once logged in, ticking as time passes", () => {
    vi.useFakeTimers();
    const now = new Date('2026-08-18T14:05:00Z');
    vi.setSystemTime(now);
    useAuthStore.setState({ sessionStartedAt: now.getTime() - 65_000 });

    render(<SessionAndClock />);

    expect(screen.getByText('1:05')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByText('2:05')).toBeInTheDocument();
  });
});
