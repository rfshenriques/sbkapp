import type { ReportGranularity } from './backendApi';

/**
 * Matches Postgres's date_trunc semantics (UTC, ISO week starting Monday)
 * so client-side bucketing (marketing spend, which has no backend
 * time-series endpoint) lines up with the server-bucketed registrations/
 * GGR series it gets overlaid on.
 */
export function bucketDate(date: Date, granularity: ReportGranularity): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  if (granularity === 'month') return new Date(Date.UTC(year, month, 1));
  if (granularity === 'day') return new Date(Date.UTC(year, month, day));

  const weekday = new Date(Date.UTC(year, month, day)).getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;
  return new Date(Date.UTC(year, month, day - daysSinceMonday));
}
