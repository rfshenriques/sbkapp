import { useEffect, useRef } from 'react';
import { acknowledgeCelebrations } from '../../lib/backendApi';
import { useUnseenCelebrations } from '../bet-history/useUnseenCelebrations';
import { useFreebetCreditedModalStore } from './freebetCreditedModalStore';
import { useFreebets } from './useFreebets';

/** Only campaign-sourced grants have a "campaign Y" to show - manual/rollback/insurance grants never trigger this modal. */
function isCampaignSourced(source: string): boolean {
  return source === 'BET_AND_GET' || source === 'DEPOSIT_CAMPAIGN';
}

/**
 * Watches useFreebets() (polled - see useFreebets) for a new BET_AND_GET or
 * DEPOSIT_CAMPAIGN grant appearing and opens FreebetCreditedModal for it
 * once. Separately, useUnseenCelebrations() catches up on any grant credited
 * while the player wasn't in this session at all (including a plain app
 * refresh, which used to lose the modal entirely - see apps/backend's
 * FreebetGrant.notifiedAt) - the backend, not localStorage, is the source
 * of truth for "has this been shown yet", acknowledged via
 * acknowledgeCelebrations once each modal is actually dismissed. Runs once
 * at the AppShell level so it fires regardless of which page the player is
 * currently on. Mirrors useWinCelebrationDetector exactly.
 */
export function useFreebetGrantDetector() {
  const { data: freebets } = useFreebets();
  const { data: unseenCelebrations } = useUnseenCelebrations();
  const grantId = useFreebetCreditedModalStore((state) => state.grantId);
  const openModal = useFreebetCreditedModalStore((state) => state.open);
  const previousIdsRef = useRef<Set<string> | null>(null);
  const queueRef = useRef<string[]>([]);
  const handledIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!freebets) return;
    const campaignGrants = freebets.filter((grant) => isCampaignSourced(grant.source));
    const previous = previousIdsRef.current;
    const newlyGranted: string[] = [];

    if (previous) {
      for (const grant of campaignGrants) {
        if (!previous.has(grant.id) && !handledIdsRef.current.has(grant.id)) {
          newlyGranted.push(grant.id);
          handledIdsRef.current.add(grant.id);
        }
      }
    }

    queueRef.current.push(...newlyGranted);

    if (queueRef.current.length > 0 && useFreebetCreditedModalStore.getState().grantId === null) {
      const nextId = queueRef.current.shift()!;
      openModal(nextId);
    }

    previousIdsRef.current = new Set(campaignGrants.map((grant) => grant.id));
  }, [freebets, openModal]);

  useEffect(() => {
    if (!unseenCelebrations) return;
    // Non-campaign grants (MANUAL, ACCA_ROLLBACK, ...) never trigger this
    // modal, on either detection path - ack them immediately so they don't
    // keep resurfacing as "unseen" on every future login for no reason.
    const nonCampaignIds = unseenCelebrations.freebetGrants
      .filter((grant) => !isCampaignSourced(grant.source))
      .map((grant) => grant.id);
    if (nonCampaignIds.length > 0) {
      void acknowledgeCelebrations([], nonCampaignIds).catch(() => {});
    }

    const newlyUnseen = unseenCelebrations.freebetGrants
      .filter((grant) => isCampaignSourced(grant.source))
      .map((grant) => grant.id)
      .filter((id) => !handledIdsRef.current.has(id));
    for (const id of newlyUnseen) handledIdsRef.current.add(id);

    queueRef.current.push(...newlyUnseen);

    if (queueRef.current.length > 0 && useFreebetCreditedModalStore.getState().grantId === null) {
      const nextId = queueRef.current.shift()!;
      openModal(nextId);
    }
  }, [unseenCelebrations, openModal]);

  // If several grants land at once, show them one after another as each
  // modal is dismissed, instead of only ever showing the first.
  const openGrantIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (grantId !== null) {
      openGrantIdRef.current = grantId;
      return;
    }
    if (openGrantIdRef.current !== null) {
      void acknowledgeCelebrations([], [openGrantIdRef.current]).catch(() => {
        // Best-effort - if this fails, the grant is simply shown again on a
        // future login instead of silently lost, same fallback the backend
        // endpoint is designed around.
      });
      openGrantIdRef.current = null;
    }
    if (queueRef.current.length > 0) {
      const nextId = queueRef.current.shift()!;
      openModal(nextId);
    }
  }, [grantId, openModal]);
}
