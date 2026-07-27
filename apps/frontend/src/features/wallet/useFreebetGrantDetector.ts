import { useEffect, useRef } from 'react';
import { useFreebetCreditedModalStore } from './freebetCreditedModalStore';
import { useFreebets } from './useFreebets';

const STORAGE_KEY = 'sbkapp:credited-freebet-grant-ids';
const PENDING_STORAGE_KEY = 'sbkapp:pending-freebet-grant-id';
const MAX_STORED_IDS = 200;
// A grant credited just before this hook's first poll of a fresh mount (e.g.
// a campaign settled moments before the player opened/refreshed the app)
// still deserves the modal - anything older than this, with no pending grant
// to resume (see below), is assumed already seen on a prior visit.
const RECENT_GRANT_THRESHOLD_MS = 2 * 60_000;

/** Only campaign-sourced grants have a "campaign Y" to show - manual/rollback/insurance grants never trigger this modal. */
function isCampaignSourced(source: string): boolean {
  return source === 'BET_AND_GET' || source === 'DEPOSIT_CAMPAIGN';
}

function loadCreditedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

/**
 * Only ever called once the modal has actually been dismissed by the player
 * (see the close-tracking effect below) - never at detection time, same
 * reasoning as useWinCelebrationDetector's markCelebrated: `registerType:
 * 'autoUpdate'` (vite.config.ts) can reload the page between detecting a
 * grant and the player actually seeing the modal, and marking at detection
 * time would silently lose an unseen notification across that reload.
 */
function markCredited(grantId: string) {
  const ids = loadCreditedIds();
  ids.add(grantId);
  const trimmed = Array.from(ids).slice(-MAX_STORED_IDS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Best-effort only - showing the modal again on a rare reload is a much
    // better failure mode than silently not persisting.
  }
}

function loadPendingGrantId(): string | null {
  try {
    return localStorage.getItem(PENDING_STORAGE_KEY);
  } catch {
    return null;
  }
}

function setPendingGrantId(grantId: string | null) {
  try {
    if (grantId === null) {
      localStorage.removeItem(PENDING_STORAGE_KEY);
    } else {
      localStorage.setItem(PENDING_STORAGE_KEY, grantId);
    }
  } catch {
    // Best-effort only, same reasoning as markCredited.
  }
}

/**
 * Watches useFreebets() (polled - see useFreebets) for a new BET_AND_GET or
 * DEPOSIT_CAMPAIGN grant appearing and opens FreebetCreditedModal for it
 * once. Mirrors useWinCelebrationDetector's reload-resilient
 * pending/permanent-localStorage pattern exactly. Runs once at the AppShell
 * level so it fires regardless of which page the player is currently on.
 */
export function useFreebetGrantDetector() {
  const { data: freebets } = useFreebets();
  const grantId = useFreebetCreditedModalStore((state) => state.grantId);
  const openModal = useFreebetCreditedModalStore((state) => state.open);
  const previousIdsRef = useRef<Set<string> | null>(null);
  const queueRef = useRef<string[]>([]);
  const openGrantIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!freebets) return;
    const campaignGrants = freebets.filter((grant) => isCampaignSourced(grant.source));
    const previous = previousIdsRef.current;
    const credited = loadCreditedIds();
    const newlyGranted: string[] = [];

    if (previous) {
      for (const grant of campaignGrants) {
        if (!previous.has(grant.id) && !credited.has(grant.id)) {
          newlyGranted.push(grant.id);
        }
      }
    } else {
      const pendingId = loadPendingGrantId();
      const resumedGrant = pendingId
        ? campaignGrants.find((grant) => grant.id === pendingId && !credited.has(grant.id))
        : undefined;
      if (resumedGrant) {
        newlyGranted.push(resumedGrant.id);
      } else {
        const now = Date.now();
        const recentGrant = campaignGrants.find(
          (grant) => !credited.has(grant.id) && now - new Date(grant.createdAt).getTime() < RECENT_GRANT_THRESHOLD_MS,
        );
        if (recentGrant) newlyGranted.push(recentGrant.id);
      }
    }

    queueRef.current.push(...newlyGranted);

    if (queueRef.current.length > 0 && useFreebetCreditedModalStore.getState().grantId === null) {
      const nextId = queueRef.current.shift()!;
      setPendingGrantId(nextId);
      openModal(nextId);
    }

    previousIdsRef.current = new Set(campaignGrants.map((grant) => grant.id));
  }, [freebets, openModal]);

  // If several grants land in the same poll, show them one after another as
  // each modal is dismissed, instead of only ever showing the first.
  useEffect(() => {
    if (grantId !== null) {
      openGrantIdRef.current = grantId;
      return;
    }
    if (openGrantIdRef.current !== null) {
      markCredited(openGrantIdRef.current);
      setPendingGrantId(null);
      openGrantIdRef.current = null;
    }
    if (queueRef.current.length > 0) {
      const nextId = queueRef.current.shift()!;
      setPendingGrantId(nextId);
      openModal(nextId);
    }
  }, [grantId, openModal]);
}
