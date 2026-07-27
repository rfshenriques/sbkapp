import { useEffect, useRef } from 'react';
import { useBets } from './useBets';
import { useWinCelebrationStore } from './winCelebrationStore';

const STORAGE_KEY = 'sbkapp:celebrated-bet-ids';
const MAX_STORED_IDS = 200;

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
 * WinCelebrationModal for it once. Never fires for a bet that was already
 * WON on this hook's first render - only a transition witnessed live
 * counts, otherwise every login would replay every past win. Runs once at
 * the AppShell level so it fires regardless of which page the player is
 * currently on.
 */
export function useWinCelebrationDetector() {
  const { data: bets } = useBets();
  const openCelebration = useWinCelebrationStore((state) => state.open);
  const previousStatusesRef = useRef<Map<string, string> | null>(null);

  useEffect(() => {
    if (!bets) return;
    const previous = previousStatusesRef.current;

    if (previous) {
      const celebrated = loadCelebratedIds();
      for (const bet of bets) {
        const previousStatus = previous.get(bet.id);
        if (previousStatus === 'PENDING' && bet.status === 'WON' && !celebrated.has(bet.id)) {
          markCelebrated(bet.id);
          openCelebration(bet.id);
          break;
        }
      }
    }

    previousStatusesRef.current = new Map(bets.map((bet) => [bet.id, bet.status]));
  }, [bets, openCelebration]);
}
