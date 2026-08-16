import { useAuthStore } from '../features/auth/authStore';
import { useBrandStore } from '../features/brand/brandStore';

const BASE_URL = '/backend';
const SESSION_STORAGE_KEY = 'sportsbook_analytics_session_id';
/** How often a non-empty queue gets flushed - short enough that the backoffice's live panel feels responsive, long enough to actually batch. */
const FLUSH_INTERVAL_MS = 8_000;
const MAX_BATCH_SIZE = 20;

export type AnalyticsEventType =
  | 'PAGE_VIEW'
  | 'SEARCH'
  | 'CLICK'
  | 'LOGIN'
  | 'BET_PLACED'
  | 'BET_NOT_FINISHED';

interface QueuedEvent {
  type: AnalyticsEventType;
  path?: string;
  metadata?: Record<string, unknown>;
}

let queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | undefined;

/** Anonymous id, independent of login state, so one browsing session can be traced end to end across a login/logout. */
function getSessionId(): string {
  let sessionId = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  }
  return sessionId;
}

/**
 * useBeacon is for the tab-close/navigate-away moment (pagehide) - a normal
 * fetch can be cancelled mid-flight before it reaches the network there (see
 * backendApi.logoutBeacon for the same reasoning). sendBeacon can't attach
 * an Authorization header, so a beacon-flushed batch loses userId
 * attribution even if the player was logged in - acceptable, this is
 * best-effort analytics, not a security or money boundary.
 */
function flush(useBeacon = false): void {
  if (queue.length === 0) return;
  const brandId = useBrandStore.getState().brandId;
  if (!brandId) {
    // Brand not resolved yet (very first paint) - drop rather than hold
    // forever; the next flush after resolution just misses this one batch.
    queue = [];
    return;
  }

  const events = queue.splice(0, MAX_BATCH_SIZE);
  const body = JSON.stringify({ brandId, sessionId: getSessionId(), events });

  if (useBeacon && navigator.sendBeacon) {
    navigator.sendBeacon(`${BASE_URL}/public/analytics/events`, new Blob([body], { type: 'application/json' }));
    return;
  }

  const token = useAuthStore.getState().accessToken;
  void fetch(`${BASE_URL}/public/analytics/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body,
    keepalive: true,
  }).catch(() => {
    // Best-effort - a dropped analytics event should never surface to the player.
  });
}

export function track(
  type: AnalyticsEventType,
  options: { path?: string; metadata?: Record<string, unknown> } = {},
): void {
  queue.push({ type, path: options.path, metadata: options.metadata });
  if (queue.length >= MAX_BATCH_SIZE) {
    flush();
  }
}

/**
 * Mounted once from AppShell (useAnalyticsPageViews) - starts the periodic
 * flush and wires the tab-close flush. Deliberately not started implicitly
 * from track() itself: a component test that renders e.g. LoginPage or
 * BetSlipPanel in isolation (without mounting AppShell) calls track() too,
 * and a stray setInterval left running past that test would eventually fire
 * fetch() against whatever unrelated fetch mock happens to be active in a
 * later test.
 */
export function initAnalytics(): void {
  if (flushTimer === undefined) {
    flushTimer = setInterval(() => flush(), FLUSH_INTERVAL_MS);
  }
  window.addEventListener('pagehide', () => flush(true));
}
