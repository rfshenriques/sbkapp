import { useEffect, useRef } from 'react';
import { useBets } from './useBets';
import { useWinCelebrationStore } from './winCelebrationStore';

const STORAGE_KEY = 'sbkapp:celebrated-bet-ids';
const PENDING_STORAGE_KEY = 'sbkapp:pending-celebration-bet-id';
const MAX_STORED_IDS = 200;
// A bet settled just before this hook's first poll of a fresh mount (e.g.
// staff settled it moments before the player opened/refreshed the app)
// still deserves a celebration - anything older than this, with no pending
// celebration to resume (see below), is assumed already seen on a prior
// visit, so it's not replayed.
const RECENT_WIN_THRESHOLD_MS = 2 * 60_000;

function loadCelebratedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

/**
 * Only ever called once a celebration has actually been dismissed by the
 * player (see the close-tracking effect below) - never at detection time.
 * Detection-time marking was the original bug: `registerType: 'autoUpdate'`
 * (vite.config.ts) reloads the page the instant an updated service worker
 * activates, which commonly happens right as the app is foregrounded again
 * after being backgrounded. That reload can land in the gap between
 * detecting a win and the player actually seeing the modal - if the id were
 * already burned into this set before the reload, the fresh mount would
 * silently skip it forever even though it was never shown.
 */
function markCelebrated(betId: string) {
  const ids = loadCelebratedIds();
  ids.add(betId);
  const trimmed = Array.from(ids).slice(-MAX_STORED_IDS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Best-effort only - a full-page celebration on every visit is a much
    // worse failure mode than silently not persisting, so never throw here.
  }
}

function loadPendingCelebrationId(): string | null {
  try {
    return localStorage.getItem(PENDING_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Set right before a celebration opens, cleared once it's dismissed - the
 * one thing that survives a same-session reload the modal itself can't (see
 * markCelebrated above). On the next mount, a pending id is resumed
 * unconditionally regardless of how long ago the bet settled, unlike the
 * time-boxed RECENT_WIN_THRESHOLD_MS fallback - the player already had this
 * celebration queued or open, so it should always finish, not just when the
 * reload happens to be quick.
 */
function setPendingCelebrationId(betId: string | null) {
  try {
    if (betId === null) {
      localStorage.removeItem(PENDING_STORAGE_KEY);
    } else {
      localStorage.setItem(PENDING_STORAGE_KEY, betId);
    }
  } catch {
    // Best-effort only, same reasoning as markCelebrated.
  }
}

/**
 * Watches useBets() (polled - see useBets) for a bet that flips from
 * PENDING to WON while the player is in the app, and opens
 * WinCelebrationModal for it once. Also covers a bet that settled to WON
 * just before this hook's first poll of a fresh mount (RECENT_WIN_THRESHOLD_MS)
 * - otherwise a player who opens/refreshes the app right after staff settle
 * their bet would never see a celebration, since no live transition would
 * ever be witnessed. Anything older than that on first load is assumed
 * already seen on a prior visit and never replayed, unless it was left
 * pending by an interrupted celebration (see setPendingCelebrationId), which
 * is always resumed regardless of age. Runs once at the AppShell level so
 * it fires regardless of which page the player is currently on.
 */
export function useWinCelebrationDetector() {
  const { data: bets } = useBets();
  const betId = useWinCelebrationStore((state) => state.betId);
  const openCelebration = useWinCelebrationStore((state) => state.open);
  const previousStatusesRef = useRef<Map<string, string> | null>(null);
  // Ids detected this poll but not shown yet because another celebration was
  // already open - drained by the effect below as each one closes. A plain
  // ref (not state) since queuing must never itself trigger a re-render/re-run
  // of the detection effect.
  const queueRef = useRef<string[]>([]);
  // The betId this hook itself last opened, so the close-tracking effect
  // below knows which id to burn into the permanent celebrated set once
  // betId reverts to null - it can't just trust the store's own previous
  // value since that effect only observes betId, not who opened it.
  const openBetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!bets) return;
    const previous = previousStatusesRef.current;
    const celebrated = loadCelebratedIds();
    const newlyWon: string[] = [];

    if (previous) {
      for (const bet of bets) {
        if (previous.get(bet.id) === 'PENDING' && bet.status === 'WON' && !celebrated.has(bet.id)) {
          newlyWon.push(bet.id);
        }
      }
    } else {
      const pendingId = loadPendingCelebrationId();
      const resumedBet = pendingId
        ? bets.find((bet) => bet.id === pendingId && bet.status === 'WON' && !celebrated.has(bet.id))
        : undefined;
      if (resumedBet) {
        newlyWon.push(resumedBet.id);
      } else {
        const now = Date.now();
        const recentWin = bets.find(
          (bet) =>
            bet.status === 'WON' &&
            bet.settledAt !== null &&
            !celebrated.has(bet.id) &&
            now - new Date(bet.settledAt).getTime() < RECENT_WIN_THRESHOLD_MS,
        );
        if (recentWin) newlyWon.push(recentWin.id);
      }
    }

    queueRef.current.push(...newlyWon);

    if (queueRef.current.length > 0 && useWinCelebrationStore.getState().betId === null) {
      const nextId = queueRef.current.shift()!;
      setPendingCelebrationId(nextId);
      openCelebration(nextId);
    }

    previousStatusesRef.current = new Map(bets.map((bet) => [bet.id, bet.status]));
  }, [bets, openCelebration]);

  // If several bets settled in the same poll, show them one after another
  // as each celebration is dismissed, instead of only ever showing the
  // first and losing the rest. Also where a just-dismissed celebration
  // finally gets permanently marked celebrated (see markCelebrated above).
  useEffect(() => {
    if (betId !== null) {
      openBetIdRef.current = betId;
      return;
    }
    if (openBetIdRef.current !== null) {
      markCelebrated(openBetIdRef.current);
      setPendingCelebrationId(null);
      openBetIdRef.current = null;
    }
    if (queueRef.current.length > 0) {
      const nextId = queueRef.current.shift()!;
      setPendingCelebrationId(nextId);
      openCelebration(nextId);
    }
  }, [betId, openCelebration]);
}
