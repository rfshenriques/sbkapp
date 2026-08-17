const STORAGE_KEY = 'sportsbook_last_forced_login_prompt_at';
const THROTTLE_MS = 60 * 60 * 1000;

/**
 * Whether AppShell's forced-login prompt (silent biometric attempt, then
 * the login sheet - see AppShell.tsx) is due to fire again on this device.
 * The prompt used to fire on every single page load - a plain in-memory
 * ref only guards against React re-rendering within one already-open tab,
 * not a browser refresh, which remounts the whole tree and resets it right
 * back to false. Persisting the last-fired timestamp in localStorage
 * (per-device, like themePreferenceStore, not tied to the account) makes
 * "once per hour" survive a refresh instead of just "once per mount".
 */
export function shouldShowForcedLoginPrompt(now: number = Date.now()): boolean {
  const lastShownAt = Number(localStorage.getItem(STORAGE_KEY));
  return !Number.isFinite(lastShownAt) || lastShownAt <= 0 || now - lastShownAt >= THROTTLE_MS;
}

/** Call once the prompt is actually about to fire, not on every check - stamps "now" so the next hour's worth of refreshes skip it. */
export function recordForcedLoginPromptShown(now: number = Date.now()): void {
  localStorage.setItem(STORAGE_KEY, String(now));
}
