const THREE_DAYS_MS = 3 * 24 * 60 * 60_000;

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * "Today"/"Tomorrow" + time take priority over everything else (viewer's
 * local calendar day, not UTC). Beyond that: weekday + time inside a 3-day
 * window (e.g. "Wed · 18:30") - date is redundant that close out. Beyond
 * 3 days, weekday stops being useful and the date matters more (e.g.
 * "19 Jul · 18:30").
 */
export function formatKickoff(kickoff: Date, now: Date = new Date()): string {
  const timeStr = kickoff.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  if (isSameCalendarDay(kickoff, now)) {
    return `Today · ${timeStr}`;
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (isSameCalendarDay(kickoff, tomorrow)) {
    return `Tomorrow · ${timeStr}`;
  }

  const withinThreeDays = kickoff.getTime() - now.getTime() < THREE_DAYS_MS;
  const dateStr = withinThreeDays
    ? kickoff.toLocaleDateString(undefined, { weekday: 'short' })
    : kickoff.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  return `${dateStr} · ${timeStr}`;
}
