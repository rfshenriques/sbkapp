import type { AudienceMode } from '@prisma/client';

/** What's known about the current viewer for audience-targeting purposes - resolved softly, no login required to browse. */
export interface AudienceViewer {
  isLoggedIn: boolean;
  /** Segment ids the viewer belongs to; empty when logged out or not in any segment. */
  segmentIds: string[];
}

export const ANONYMOUS_VIEWER: AudienceViewer = { isLoggedIn: false, segmentIds: [] };

/**
 * Whether a piece of targeted content (manual market, boost, ...) is
 * visible to this viewer. SEGMENTS is an OR match - the viewer needs only
 * one of the content's assigned segments, not all of them.
 */
export function resolveAudience(
  mode: AudienceMode,
  audienceSegmentIds: string[],
  viewer: AudienceViewer,
): boolean {
  switch (mode) {
    case 'ALL':
      return true;
    case 'LOGGED_OUT':
      return !viewer.isLoggedIn;
    case 'LOGGED_IN':
      return viewer.isLoggedIn;
    case 'SEGMENTS':
      return audienceSegmentIds.some((segmentId) => viewer.segmentIds.includes(segmentId));
  }
}
