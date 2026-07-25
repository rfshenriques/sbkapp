/** Formats an ISO instant as a `datetime-local` input value in the browser's own local time, or '' when null. */
export function isoToLocalInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Parses a `datetime-local` input value (interpreted in the browser's own local time, per the input's own spec) back to an ISO instant, or null when empty. */
export function localInputValueToIso(value: string): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

const SCHEDULE_FORMAT: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' };

/** "Scheduled: <start> → <end>", omitting whichever side is unset - shared summary line for campaign list cards. */
export function formatScheduleWindow(campaign: { startAt: string | null; endAt: string | null }): string {
  const start = campaign.startAt ? new Date(campaign.startAt).toLocaleString(undefined, SCHEDULE_FORMAT) : null;
  const end = campaign.endAt ? new Date(campaign.endAt).toLocaleString(undefined, SCHEDULE_FORMAT) : null;
  if (start && end) return `Scheduled: ${start} → ${end}`;
  if (start) return `Scheduled: from ${start}`;
  return `Scheduled: until ${end}`;
}
