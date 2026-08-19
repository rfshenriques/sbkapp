import type { LiveScoreboardEntry } from '@sportsbook/shared';
import type { ApiSportsClient } from './client';
import { findMatchingFixture } from './match-fixture-mapper';

export interface ScoreboardMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
}

export interface LiveScoreboardServiceOptions {
  client: ApiSportsClient;
  /** Whatever the caller currently considers live - cheap to call (eventsService.listMatches() serves this from its own 24h cache, no extra network request), unlike client.getLiveFixtures() below. */
  listLiveMatches: () => Promise<ScoreboardMatch[]>;
  pollIntervalMs?: number;
  now?: () => number;
}

export interface LiveScoreboardService {
  /** Resolves once the first poll completes, so a caller (or a test) can await a populated scoreboard rather than racing the background interval. */
  start(): Promise<void>;
  stop(): void;
  getScoreboard(): Record<string, LiveScoreboardEntry>;
}

/**
 * Covers every currently-live match in a single api-sports request
 * (getLiveFixtures returns every live fixture worldwide at once) - unlike
 * LiveTrackerService's per-match events+stats tracking (3 requests, one
 * match at a time, see its own budget comment), which several concurrently
 * live matches thrash against each other for since only one can ever be
 * the tracked one. This is what actually scales to "every live match shows
 * a score", at the cost of only the bare score/clock, not events or stats.
 * A long poll interval (still well inside api-sports' 100 requests/day
 * free-tier cap even continuously running, since this is always exactly 1
 * request per poll regardless of how many matches are live, and 0 when
 * none are) trades update frequency for headroom - see
 * DEFAULT_POLL_INTERVAL_MS below.
 */
const DEFAULT_POLL_INTERVAL_MS = 10 * 60_000;

export function createLiveScoreboardService(options: LiveScoreboardServiceOptions): LiveScoreboardService {
  const { client, listLiveMatches, pollIntervalMs = DEFAULT_POLL_INTERVAL_MS, now = Date.now } = options;

  let scoreboard: Record<string, LiveScoreboardEntry> = {};
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  let stopped = true;

  async function pollOnce(): Promise<void> {
    try {
      const liveMatches = await listLiveMatches();
      if (liveMatches.length === 0) {
        scoreboard = {};
        return;
      }

      const fixtures = await client.getLiveFixtures();
      const next: Record<string, LiveScoreboardEntry> = {};
      for (const match of liveMatches) {
        const fixture = findMatchingFixture(match, fixtures);
        if (!fixture) continue;
        next[match.id] = {
          matchId: match.id,
          minute: fixture.fixture.status.elapsed ?? 0,
          period: fixture.fixture.status.short,
          homeScore: fixture.goals.home ?? 0,
          awayScore: fixture.goals.away ?? 0,
          updatedAt: new Date(now()).toISOString(),
        };
      }
      scoreboard = next;
    } catch (error) {
      // Best-effort - leave the previous snapshot in place (still better
      // than blanking every live score out over one transient failure) and
      // try again on the next scheduled poll.
      console.error('LiveScoreboardService poll failed:', error instanceof Error ? error.message : error);
    }
  }

  function scheduleNext(): void {
    if (stopped) return;
    timeoutHandle = setTimeout(() => void pollOnce().then(scheduleNext), pollIntervalMs);
  }

  return {
    async start() {
      if (!stopped) return;
      stopped = false;
      await pollOnce();
      scheduleNext();
    },
    stop() {
      stopped = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
      timeoutHandle = undefined;
    },
    getScoreboard: () => scoreboard,
  };
}
