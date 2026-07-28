import type { Match } from '@sportsbook/shared';
import { isSameCalendarDay } from './formatKickoff';

export type MatchDateBucket = 'today' | 'tomorrow' | 'soon';

/**
 * Live matches always bucket as "today" regardless of when they kicked off -
 * they're already underway. Everything else buckets by the viewer's local
 * calendar day: today, tomorrow, or "soon" for anything further out.
 */
export function matchDateBucket(
  match: Pick<Match, 'kickoff' | 'isLive'>,
  now: Date = new Date(),
): MatchDateBucket {
  if (match.isLive) return 'today';

  const kickoff = new Date(match.kickoff);
  if (isSameCalendarDay(kickoff, now)) return 'today';

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (isSameCalendarDay(kickoff, tomorrow)) return 'tomorrow';

  return 'soon';
}
