import { useEffect, useState } from 'react';
import { useAuthStore } from '../auth/authStore';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** H:MM:SS (or MM:SS under an hour) - elapsed duration, not a clock face. */
function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

function formatClock(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * A small regulatory time-awareness readout in the footer: how long the
 * player has been logged in this session, and the current time - both with
 * seconds, both ticking live. The session timer only shows once logged in
 * (sessionStartedAt is null for a guest - see authStore.setAuth); the clock
 * always shows, since knowing what time it is doesn't require an account.
 */
export function SessionAndClock() {
  const sessionStartedAt = useAuthStore((state) => state.sessionStartedAt);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted tabular-nums">
      {sessionStartedAt !== null && (
        <span>
          Session <span className="font-semibold text-text-secondary">{formatDuration(now.getTime() - sessionStartedAt)}</span>
        </span>
      )}
      <span>
        Current time <span className="font-semibold text-text-secondary">{formatClock(now)}</span>
      </span>
    </div>
  );
}
