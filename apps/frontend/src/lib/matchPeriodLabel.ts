/** Provider status-code (api-football's fixture.status.short) -> a short, player-facing label for "which part of the match is happening right now". */
const PERIOD_LABELS: Record<string, string> = {
  '1H': '1st Half',
  HT: 'Half-time',
  '2H': '2nd Half',
  ET: 'Extra Time',
  BT: 'Break',
  P: 'Penalties',
  SUSP: 'Suspended',
  INT: 'Interrupted',
  LIVE: 'Live',
};

/** Falls back to the raw code for anything not in the map above, rather than hiding it - an unrecognized code is still more useful shown than silently dropped. */
export function matchPeriodLabel(period: string): string {
  return PERIOD_LABELS[period] ?? period;
}
