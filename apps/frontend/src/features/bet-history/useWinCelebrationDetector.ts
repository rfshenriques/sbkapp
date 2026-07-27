import { useEffect, useRef } from 'react';
import { useBets } from './useBets';
import { useWinCelebrationStore } from './winCelebrationStore';

const STORAGE_KEY = 'sbkapp:celebrated-bet-ids';
const MAX_STORED_IDS = 200;
// A bet settled just before this hook's first poll of a fresh mount (e.g.
// staff settled it moments before the player opened/refreshed the app)
// still deserves a celebration - anything older than this is assumed
// already seen on a prior visit, so it's not replayed.
const RECENT_WIN_THRESHOLD_MS = 2 * 60_000;

function loadCelebratedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

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

/**
 * Watches useBets() (polled - see useBets) for a bet that flips from
 * PENDING to WON while the player is in the app, and opens
 * WinCelebrationModal for it once. Also covers a bet that settled to WON
 * just before this hook's first poll of a fresh mount (RECENT_WIN_THRESHOLD_MS)
 * - otherwise a player who opens/refreshes the app right after staff settle
 * their bet would never see a celebration, since no live transition would
 * ever be witnessed. Anything older than that on first load is assumed
 * already seen on a prior visit and never replayed. Runs once at the
 * AppShell level so it fires regardless of which page the player is
 * currently on.
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

    for (const id of newlyWon) {
      markCelebrated(id);
      queueRef.current.push(id);
    }

    if (queueRef.current.length > 0 && useWinCelebrationStore.getState().betId === null) {
      openCelebration(queueRef.current.shift()!);
    }

    previousStatusesRef.current = new Map(bets.map((bet) => [bet.id, bet.status]));
  }, [bets, openCelebration]);

  // If several bets settled in the same poll, show them one after another
  // as each celebration is dismissed, instead of only ever showing the
  // first and losing the rest.
  useEffect(() => {
    if (betId === null && queueRef.current.length > 0) {
      openCelebration(queueRef.current.shift()!);
    }
  }, [betId, openCelebration]);
}
