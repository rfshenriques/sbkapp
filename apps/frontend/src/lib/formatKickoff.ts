const THREE_DAYS_MS = 3 * 24 * 60 * 60_000;

/**
 * Weekday + time inside a 3-day window (e.g. "Sat · 18:30") - date is
 * redundant that close out. Beyond that, weekday stops being useful and
 * the date matters more (e.g. "19 Jul · 18:30").
 */
export function formatKickoff(kickoff: Date, now: Date = new Date()): string {
  const timeStr = kickoff.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const withinThreeDays = kickoff.getTime() - now.getTime() < THREE_DAYS_MS;

  const dateStr = withinThreeDays
    ? kickoff.toLocaleDateString(undefined, { weekday: 'short' })
    : kickoff.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  return `${dateStr} · ${timeStr}`;
}
