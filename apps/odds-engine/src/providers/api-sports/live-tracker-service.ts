import type { LiveMatchMomentum, LiveMatchStat, LiveMatchState } from '@sportsbook/shared';
import type { ApiSportsClient } from './client';
import { findMatchingFixture } from './match-fixture-mapper';
import { computeMomentum } from './momentum';
import { normalizeEvents, normalizeStats } from './normalize';

const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN', 'CANC', 'ABD', 'AWD', 'WO']);

/**
 * One poll costs 3 requests (fixture score/status, events, statistics). The
 * free api-sports plan is 100 requests/day - see docs/PROJECT_BRIEF.md
 * Section 4/10 for the full budget reasoning. At ~3.5 min this keeps one
 * continuously-tracked ~105-minute match (90 + stoppage) to ~90 requests,
 * leaving headroom for the initial live-fixtures lookup and any dev
 * restarts, without approaching the cap. Revisit once on a paid plan.
 */
const DEFAULT_POLL_INTERVAL_MS = 3.5 * 60_000;

export interface LiveTrackerMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
}

export interface LiveTrackerServiceOptions {
  client: ApiSportsClient;
  pollIntervalMs?: number;
  /** Called after every successful poll - the hook the WS layer pushes updates through. */
  onUpdate?: (state: LiveMatchState) => void;
  now?: () => number;
}

export interface LiveTrackerService {
  /**
   * Starts tracking this match's live data, replacing whatever was
   * previously tracked (only one match is tracked at a time - see the
   * budget comment above). A no-op if this match is already the one being
   * tracked. Resolves once the first poll completes (or once it's clear no
   * matching live fixture exists).
   */
  track(match: LiveTrackerMatch): Promise<void>;
  /** The most recent snapshot for this match, if it's the one currently tracked. */
  getState(matchId: string): LiveMatchState | undefined;
  stop(): void;
}

export function createLiveTrackerService(options: LiveTrackerServiceOptions): LiveTrackerService {
  const { client, pollIntervalMs = DEFAULT_POLL_INTERVAL_MS, onUpdate, now = Date.now } = options;

  let currentMatchId: string | undefined;
  let currentFixtureId: number | undefined;
  let homeTeamId: number | undefined;
  let latestState: LiveMatchState | undefined;
  let previousStats: LiveMatchStat[] | undefined;
  let previousMomentum: LiveMatchMomentum | undefined;
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  function stopPolling() {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    timeoutHandle = undefined;
  }

  /** Full teardown - used when switching to a different match or on explicit stop(). */
  function reset() {
    stopPolling();
    currentMatchId = undefined;
    currentFixtureId = undefined;
    homeTeamId = undefined;
    latestState = undefined;
    previousStats = undefined;
    previousMomentum = undefined;
  }

  async function pollOnce(): Promise<void> {
    if (currentFixtureId === undefined || homeTeamId === undefined || !currentMatchId) return;

    const [fixture, events, stats] = await Promise.all([
      client.getFixtureById(currentFixtureId),
      client.getFixtureEvents(currentFixtureId),
      client.getFixtureStatistics(currentFixtureId),
    ]);

    if (!fixture) {
      // Fixture disappeared from the provider - nothing sensible left to show.
      reset();
      return;
    }

    const normalizedStats = normalizeStats(stats, homeTeamId);
    const momentum = computeMomentum(previousStats, normalizedStats, previousMomentum);

    latestState = {
      matchId: currentMatchId,
      minute: fixture.fixture.status.elapsed ?? 0,
      period: fixture.fixture.status.short,
      homeScore: fixture.goals.home ?? 0,
      awayScore: fixture.goals.away ?? 0,
      events: normalizeEvents(events, homeTeamId),
      stats: normalizedStats,
      momentum,
      updatedAt: new Date(now()).toISOString(),
    };
    previousStats = normalizedStats;
    previousMomentum = momentum;

    onUpdate?.(latestState);

    if (FINISHED_STATUSES.has(fixture.fixture.status.short)) {
      // Stop polling a finished match, but keep the final snapshot (and
      // currentMatchId) around so getState still returns the final score
      // instead of disappearing right as the match ends.
      stopPolling();
      return;
    }

    timeoutHandle = setTimeout(() => void pollOnce(), pollIntervalMs);
  }

  return {
    async track(match) {
      if (currentMatchId === match.id) return;
      reset();

      const fixtures = await client.getLiveFixtures();
      const fixture = findMatchingFixture(match, fixtures);
      if (!fixture) return;

      currentMatchId = match.id;
      currentFixtureId = fixture.fixture.id;
      homeTeamId = fixture.teams.home.id;

      await pollOnce();
    },
    getState(matchId) {
      return currentMatchId === matchId ? latestState : undefined;
    },
    stop: reset,
  };
}
