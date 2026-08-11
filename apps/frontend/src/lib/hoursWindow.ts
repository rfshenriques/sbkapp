/** Rolling hour windows for the homepage's Upcoming section - distinct from
 * matchDateBucket's calendar-day buckets (Today/Tomorrow/Soon, used on the
 * Sport page): "3h" means "kicks off within the next 3 hours from now",
 * not "today". */
export type HoursWindow = '3' | '24' | '48' | 'all';

export const HOURS_WINDOWS: HoursWindow[] = ['3', '24', '48', 'all'];

export const HOURS_WINDOW_LABELS: Record<HoursWindow, string> = {
  '3': '3h',
  '24': '24h',
  '48': '48h',
  all: 'All',
};

export function isWithinHoursWindow(window: HoursWindow, kickoff: Date, now: Date = new Date()): boolean {
  if (window === 'all') return true;
  const hours = Number(window);
  return kickoff.getTime() - now.getTime() <= hours * 60 * 60 * 1000;
}
