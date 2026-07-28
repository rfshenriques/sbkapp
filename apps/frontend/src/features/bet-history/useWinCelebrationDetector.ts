import { useEffect, useRef } from 'react';
import { acknowledgeCelebrations } from '../../lib/backendApi';
import { useBets } from './useBets';
import { useUnseenCelebrations } from './useUnseenCelebrations';
import { useWinCelebrationStore } from './winCelebrationStore';

/**
 * Watches useBets() (polled - see useBets) for a bet that flips from PENDING
 * to WON while the player is in the app, and opens WinCelebrationModal for
 * it once. Separately, useUnseenCelebrations() catches up on any bet that
 * settled WON while the player wasn't in this session at all (including a
 * plain app refresh, which used to lose the celebration entirely - see
 * apps/backend's Bet.winNotifiedAt) - the backend, not localStorage, is the
 * source of truth for "has this been shown yet", acknowledged via
 * acknowledgeCelebrations once each celebration is actually dismissed. Runs
 * once at the AppShell level so it fires regardless of which page the
 * player is currently on.
 */
export function useWinCelebrationDetector() {
  const { data: bets } = useBets();
  const { data: unseenCelebrations } = useUnseenCelebrations();
  const betId = useWinCelebrationStore((state) => state.betId);
  const openCelebration = useWinCelebrationStore((state) => state.open);
  const previousStatusesRef = useRef<Map<string, string> | null>(null);
  // Ids detected but not shown yet because another celebration was already
  // open - drained by the effect below as each one closes. A plain ref (not
  // state) since queuing must never itself trigger a re-render/re-run of the
  // detection effects.
  const queueRef = useRef<string[]>([]);
  // Every id ever queued this session (open, pending, or already shown) -
  // guards against the unseen-celebrations query re-delivering the same
  // still-unacknowledged id (e.g. a window-focus refetch racing an
  // in-flight ack) and queuing it a second time.
  const handledIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!bets) return;
    const previous = previousStatusesRef.current;
    const newlyWon: string[] = [];

    if (previous) {
      for (const bet of bets) {
        if (previous.get(bet.id) === 'PENDING' && bet.status === 'WON' && !handledIdsRef.current.has(bet.id)) {
          newlyWon.push(bet.id);
          handledIdsRef.current.add(bet.id);
        }
      }
    }

    queueRef.current.push(...newlyWon);

    if (queueRef.current.length > 0 && useWinCelebrationStore.getState().betId === null) {
      const nextId = queueRef.current.shift()!;
      openCelebration(nextId);
    }

    previousStatusesRef.current = new Map(bets.map((bet) => [bet.id, bet.status]));
  }, [bets, openCelebration]);

  useEffect(() => {
    if (!unseenCelebrations) return;
    const newlyUnseen = unseenCelebrations.wonBets
      .map((bet) => bet.id)
      .filter((id) => !handledIdsRef.current.has(id));
    for (const id of newlyUnseen) handledIdsRef.current.add(id);

    queueRef.current.push(...newlyUnseen);

    if (queueRef.current.length > 0 && useWinCelebrationStore.getState().betId === null) {
      const nextId = queueRef.current.shift()!;
      openCelebration(nextId);
    }
  }, [unseenCelebrations, openCelebration]);

  // If several bets settled in the same poll (or several were unseen at
  // once), show them one after another as each celebration is dismissed,
  // instead of only ever showing the first and losing the rest.
  const openBetIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (betId !== null) {
      openBetIdRef.current = betId;
      return;
    }
    if (openBetIdRef.current !== null) {
      void acknowledgeCelebrations([openBetIdRef.current], []).catch(() => {
        // Best-effort - if this fails, the bet is simply shown again on a
        // future login instead of silently lost, same fallback the backend
        // endpoint is designed around.
      });
      openBetIdRef.current = null;
    }
    if (queueRef.current.length > 0) {
      const nextId = queueRef.current.shift()!;
      openCelebration(nextId);
    }
  }, [betId, openCelebration]);
}
