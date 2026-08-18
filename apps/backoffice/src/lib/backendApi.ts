import type { TopNavIconKey } from '@sportsbook/shared';
import { useStaffAuthStore } from '../features/auth/staffAuthStore';

const BASE_URL = '/backend';

export interface AuthTokenResponse {
  accessToken: string;
}

export interface StaffLoginPayload {
  identifier: string;
  password: string;
}

export type StaffRole = 'ADMIN' | 'TRADING' | 'RISK' | 'CRM' | 'FRAUD' | 'CMS';

export interface StaffUser {
  id: string;
  username: string;
  email: string;
  role: StaffRole;
  createdAt: string;
}

export interface CreateStaffUserPayload {
  username: string;
  email: string;
  password: string;
  role: StaffRole;
}

export interface AuditLogEntry {
  id: string;
  actorStaffUserId: string | null;
  actorUsername: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface MarketSuspension {
  id: string;
  matchId: string;
  /** Empty string means the whole match is suspended, not one specific market. */
  marketId: string;
  /** Empty string means the whole market is suspended, not one specific selection. */
  selectionId: string;
  reason: string | null;
  createdAt: string;
}

export interface CompetitionSuspension {
  id: string;
  brandId: string;
  competition: string;
  reason: string | null;
  createdAt: string;
}

export interface AccaBoostConfig {
  boostPercentPerLeg: number;
  minSelections: number;
  minOddsPerLeg: number;
  enabled: boolean;
}

export interface HomepageCarouselConfig {
  enabled: boolean;
  autoScrollSeconds: number;
}

export interface AccaRollbackConfig {
  minSelections: number;
  lossThreshold: number;
  rewardPercent: number;
  enabled: boolean;
}

export interface InsuranceBetConfig {
  costPercent: number;
  enabled: boolean;
  /** Insurance only offered/accepted on a bet whose combined odds are at least this. */
  minOdds: number;
}

export interface OddsOverride {
  id: string;
  matchId: string;
  marketId: string;
  selectionId: string;
  oddsValue: number;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ManualMarketSelection {
  id: string;
  name: string;
  odds: number;
}

export interface AudienceSegmentRef {
  segmentId: string;
}

export interface SetLimitsInput {
  maxStakeCents?: number | null;
  maxLiabilityCents?: number | null;
  audienceMode?: AudienceMode;
  segmentIds?: string[];
  staysLiveDuringInplay?: boolean;
  /** Manual markets only - a bet with 2+ selections that includes this market is rejected. */
  singlesOnly?: boolean;
}

export interface ManualMarket {
  id: string;
  matchId: string;
  name: string;
  createdAt: string;
  selections: ManualMarketSelection[];
  maxStakeCents: number | null;
  maxLiabilityCents: number | null;
  currentLiabilityCents: number;
  disabledAt: string | null;
  staysLiveDuringInplay: boolean;
  singlesOnly: boolean;
  audienceMode: AudienceMode;
  audienceSegments: AudienceSegmentRef[];
}

export interface ManualMarketSelectionInput {
  name: string;
  odds: number;
}

export interface OddsLadderRung {
  id: string;
  value: number;
  createdAt: string;
}

export interface Boost {
  id: string;
  matchId: string;
  marketId: string;
  selectionId: string;
  ticks: number;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
  maxStakeCents: number | null;
  maxLiabilityCents: number | null;
  currentLiabilityCents: number;
  disabledAt: string | null;
  staysLiveDuringInplay: boolean;
  audienceMode: AudienceMode;
  audienceSegments: AudienceSegmentRef[];
}

export interface TeamColor {
  id: string;
  name: string;
  colorHex: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StatusBreakdownEntry {
  status: string;
  count: number;
  stakeCents: number;
}

export interface PlayerSummary {
  id: string;
  email: string;
  username: string;
  phone: string;
  balanceCents: number;
  createdAt: string;
}

export interface PlayerRecentBetSelection {
  matchLabel: string;
  marketName: string;
  selectionName: string;
  odds: string;
  status: SelectionStatus;
}

export interface PlayerRecentBet {
  id: string;
  stakeCents: number;
  combinedOdds: string;
  potentialPayoutCents: number;
  settledPayoutCents: number | null;
  status: BetStatus;
  createdAt: string;
  fundedByFreebets: boolean;
  insuranceCostPercent: number;
  accaBoostPercent: number;
  campaignName: string | null;
  selections: PlayerRecentBetSelection[];
}

export interface PlayerDeposit {
  id: string;
  amountCents: number;
  createdAt: string;
}

export interface PlayerSegmentMembership {
  id: string;
  name: string;
  colorHex: string | null;
}

export interface PlayerStats {
  turnoverCents: number;
  betCount: number;
  avgStakeCents: number;
  ggrCents: number;
  openLiabilityCents: number;
  avgSelectionsPerBet: number;
  singleBetCount: number;
  accumulatorBetCount: number;
  topSports: { sport: string; count: number }[];
  topCompetitions: { competition: string; count: number }[];
}

export interface PlayerDetail {
  id: string;
  email: string;
  username: string;
  phone: string;
  phoneVerifiedAt: string | null;
  createdAt: string;
  balanceCents: number;
  freebetsCents: number;
  segments: PlayerSegmentMembership[];
  stats: PlayerStats;
  recentBets: PlayerRecentBet[];
  deposits: PlayerDeposit[];
  webauthnCredentialCount: number;
  pushSubscriptionCount: number;
}

export interface ReportSummary {
  from: string | null;
  to: string | null;
  betCount: number;
  totalStakeCents: number;
  settledBetCount: number;
  settledStakeCents: number;
  settledPayoutCents: number;
  ggrCents: number;
  statusBreakdown: StatusBreakdownEntry[];
}

export interface StaffActivityEntry {
  actorUsername: string;
  settlementCount: number;
}

export interface ReportRange {
  from?: string;
  to?: string;
}

export type ReportGranularity = 'day' | 'week' | 'month';

export interface TimeSeriesPoint {
  bucket: string;
  count: number;
}

export interface GgrTimeSeriesPoint {
  bucket: string;
  ggrCents: number;
}

export interface LiveAnalyticsSnapshot {
  activeSessions: number;
  loggedInUsers: number;
  eventsLastMinute: number;
  windowMinutes: number;
}

export interface AnalyticsEventTypeCount {
  type: string;
  count: number;
}

export interface AnalyticsPathCount {
  path: string;
  count: number;
}

export interface AnalyticsSummary {
  from: string | null;
  to: string | null;
  totalEvents: number;
  eventCounts: AnalyticsEventTypeCount[];
  topPaths: AnalyticsPathCount[];
}

export type SelectionStatus = 'OPEN' | 'WON' | 'LOST' | 'VOID';
export type BetStatus = 'PENDING' | 'WON' | 'LOST' | 'VOID';

export interface BetSelection {
  id: string;
  betId: string;
  matchId: string;
  marketId: string;
  selectionId: string;
  matchLabel: string;
  marketName: string;
  selectionName: string;
  odds: string;
  status: SelectionStatus;
  /** Snapshotted at placement time - null on selections placed before this field existed. */
  sport: string | null;
  competition: string | null;
}

export interface Bet {
  id: string;
  userId: string;
  stakeCents: number;
  combinedOdds: string;
  potentialPayoutCents: number;
  status: BetStatus;
  createdAt: string;
  settledPayoutCents: number | null;
  settledAt: string | null;
  selections: BetSelection[];
  user: { id: string; username: string; email: string };
  /** True when this bet was funded from the player's freebets balance instead of cash. */
  fundedByFreebets: boolean;
  /** Insurance premium percent deducted from the payout at placement time - 0 when not insured. */
  insuranceCostPercent: number;
  /** Acca boost percent applied at placement time - 0 for a single or an unqualifying accumulator. */
  accaBoostPercent: number;
  /** Name of the Bet & Get campaign this bet qualified for, if any. */
  betAndGetCampaignName: string | null;
  /** Name of the deposit campaign this bet fulfilled the bet-requirement for, if any. */
  depositCampaignName: string | null;
  /** Amount refunded as a freebet via Acca Rollback, if this bet triggered one. */
  accaRollbackRewardCents: number | null;
}

function extractErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as { message: unknown }).message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join(', ');
  }
  return fallback;
}

async function parseJsonOrThrow<T>(response: Response, fallbackMessage: string): Promise<T> {
  const body = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new Error(extractErrorMessage(body, fallbackMessage));
  }
  return body as T;
}

export async function staffLogin(payload: StaffLoginPayload): Promise<AuthTokenResponse> {
  const response = await fetch(`${BASE_URL}/admin/staff-auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(response, `Login failed: ${response.status}`);
}

let inFlightRefresh: Promise<AuthTokenResponse | undefined> | null = null;

/**
 * Uses the httpOnly staff refresh cookie - returns undefined (rather than
 * throwing) when there's no valid session. Deduplicated the same way as
 * the player app (apps/frontend/src/lib/backendApi.ts): refresh tokens are
 * single-use, so two concurrent callers - e.g. React StrictMode's double
 * effect invocation in dev - must share one in-flight request rather than
 * each firing their own and racing each other's rotation.
 */
export function refreshStaffAccessToken(): Promise<AuthTokenResponse | undefined> {
  if (inFlightRefresh) {
    return inFlightRefresh;
  }

  inFlightRefresh = (async () => {
    try {
      const response = await fetch(`${BASE_URL}/admin/staff-auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        return undefined;
      }
      return (await response.json()) as AuthTokenResponse;
    } finally {
      inFlightRefresh = null;
    }
  })();

  return inFlightRefresh;
}

export async function staffLogout(): Promise<void> {
  await fetch(`${BASE_URL}/admin/staff-auth/logout`, { method: 'POST', credentials: 'include' });
}

/** Attaches the current staff access token, and transparently refreshes-and-retries once on a 401. */
async function authenticatedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const requestWithToken = (token: string | null) =>
    fetch(`${BASE_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: { ...init.headers, Authorization: token ? `Bearer ${token}` : '' },
    });

  const response = await requestWithToken(useStaffAuthStore.getState().accessToken);
  if (response.status !== 401) {
    return response;
  }

  const refreshed = await refreshStaffAccessToken();
  if (!refreshed) {
    useStaffAuthStore.getState().clearAuth();
    return response;
  }

  useStaffAuthStore.getState().setAuth(refreshed.accessToken);
  return requestWithToken(refreshed.accessToken);
}

export interface ListBetsFilters {
  status?: BetStatus;
  from?: string;
  to?: string;
  player?: string;
  fundedByFreebets?: boolean;
  insured?: boolean;
  boosted?: boolean;
  hasCampaign?: boolean;
  sport?: string;
  competition?: string;
}

export async function listBets(filters: ListBetsFilters | BetStatus | undefined = undefined): Promise<Bet[]> {
  const normalized: ListBetsFilters = typeof filters === 'string' ? { status: filters } : (filters ?? {});
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(normalized)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const query = params.toString();
  const response = await authenticatedFetch(`/admin/bets${query ? `?${query}` : ''}`);
  return parseJsonOrThrow(response, `Failed to load bets: ${response.status}`);
}

export interface BetFilterOptions {
  sports: string[];
  competitions: string[];
}

export async function getBetFilterOptions(): Promise<BetFilterOptions> {
  const response = await authenticatedFetch('/admin/bets/filter-options');
  return parseJsonOrThrow(response, `Failed to load bet filter options: ${response.status}`);
}

export async function settleSelection(
  betId: string,
  selectionId: string,
  status: SelectionStatus,
): Promise<Bet> {
  const response = await authenticatedFetch(
    `/admin/bets/${betId}/selections/${selectionId}/settlement`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    },
  );
  return parseJsonOrThrow(response, `Failed to settle selection: ${response.status}`);
}

export async function listStaffUsers(): Promise<StaffUser[]> {
  const response = await authenticatedFetch('/admin/staff-users');
  return parseJsonOrThrow(response, `Failed to load staff users: ${response.status}`);
}

export async function createStaffUser(payload: CreateStaffUserPayload): Promise<StaffUser> {
  const response = await authenticatedFetch('/admin/staff-users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(response, `Failed to create staff user: ${response.status}`);
}

export async function listAuditLog(): Promise<AuditLogEntry[]> {
  const response = await authenticatedFetch('/admin/audit-log');
  return parseJsonOrThrow(response, `Failed to load audit log: ${response.status}`);
}

export async function listMarketSuspensions(): Promise<MarketSuspension[]> {
  const response = await authenticatedFetch('/admin/market-suspensions');
  return parseJsonOrThrow(response, `Failed to load market suspensions: ${response.status}`);
}

export async function suspendMarket(
  matchId: string,
  marketId: string | undefined,
  selectionId: string | undefined,
  reason: string | undefined,
): Promise<MarketSuspension> {
  const response = await authenticatedFetch('/admin/market-suspensions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ matchId, marketId, selectionId, reason }),
  });
  return parseJsonOrThrow(response, `Failed to suspend market: ${response.status}`);
}

export async function unsuspendMarket(id: string): Promise<void> {
  const response = await authenticatedFetch(`/admin/market-suspensions/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to unsuspend market: ${response.status}`);
  }
}

export async function listCompetitionSuspensions(): Promise<CompetitionSuspension[]> {
  const response = await authenticatedFetch('/admin/competition-suspensions');
  return parseJsonOrThrow(response, `Failed to load competition suspensions: ${response.status}`);
}

export async function suspendCompetition(
  competition: string,
  reason: string | undefined,
): Promise<CompetitionSuspension> {
  const response = await authenticatedFetch('/admin/competition-suspensions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ competition, reason }),
  });
  return parseJsonOrThrow(response, `Failed to suspend competition: ${response.status}`);
}

export async function unsuspendCompetition(id: string): Promise<void> {
  const response = await authenticatedFetch(`/admin/competition-suspensions/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to unsuspend competition: ${response.status}`);
  }
}

export async function listOddsOverrides(): Promise<OddsOverride[]> {
  const response = await authenticatedFetch('/admin/odds-overrides');
  return parseJsonOrThrow(response, `Failed to load odds overrides: ${response.status}`);
}

export async function setOddsOverride(
  matchId: string,
  marketId: string,
  selectionId: string,
  oddsValue: number,
  reason: string | undefined,
): Promise<OddsOverride> {
  const response = await authenticatedFetch('/admin/odds-overrides', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ matchId, marketId, selectionId, oddsValue, reason }),
  });
  return parseJsonOrThrow(response, `Failed to set odds override: ${response.status}`);
}

export async function clearOddsOverride(id: string): Promise<void> {
  const response = await authenticatedFetch(`/admin/odds-overrides/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to clear odds override: ${response.status}`);
  }
}

export async function listManualMarkets(): Promise<ManualMarket[]> {
  const response = await authenticatedFetch('/admin/manual-markets');
  return parseJsonOrThrow(response, `Failed to load manual markets: ${response.status}`);
}

export async function createManualMarket(
  matchId: string,
  name: string,
  selections: ManualMarketSelectionInput[],
): Promise<ManualMarket> {
  const response = await authenticatedFetch('/admin/manual-markets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ matchId, name, selections }),
  });
  return parseJsonOrThrow(response, `Failed to create manual market: ${response.status}`);
}

export async function updateManualMarket(
  id: string,
  name: string,
  selections: ManualMarketSelectionInput[],
): Promise<ManualMarket> {
  const response = await authenticatedFetch(`/admin/manual-markets/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, selections }),
  });
  return parseJsonOrThrow(response, `Failed to update manual market: ${response.status}`);
}

export async function removeManualMarket(id: string): Promise<void> {
  const response = await authenticatedFetch(`/admin/manual-markets/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to remove manual market: ${response.status}`);
  }
}

export async function setManualMarketLimits(id: string, input: SetLimitsInput): Promise<ManualMarket> {
  const response = await authenticatedFetch(`/admin/manual-markets/${id}/limits`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseJsonOrThrow(response, `Failed to set manual market limits: ${response.status}`);
}

export async function listOddsLadderRungs(): Promise<OddsLadderRung[]> {
  const response = await authenticatedFetch('/admin/odds-ladder');
  return parseJsonOrThrow(response, `Failed to load odds ladder: ${response.status}`);
}

export async function addOddsLadderRung(value: number): Promise<OddsLadderRung> {
  const response = await authenticatedFetch('/admin/odds-ladder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  });
  return parseJsonOrThrow(response, `Failed to add odds ladder rung: ${response.status}`);
}

export async function generateStandardOddsLadder(): Promise<OddsLadderRung[]> {
  const response = await authenticatedFetch('/admin/odds-ladder/generate-standard', { method: 'POST' });
  return parseJsonOrThrow(response, `Failed to generate standard odds ladder: ${response.status}`);
}

export async function removeOddsLadderRung(id: string): Promise<void> {
  const response = await authenticatedFetch(`/admin/odds-ladder/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error(`Failed to remove odds ladder rung: ${response.status}`);
  }
}

export async function listBoosts(): Promise<Boost[]> {
  const response = await authenticatedFetch('/admin/boosts');
  return parseJsonOrThrow(response, `Failed to load boosts: ${response.status}`);
}

export async function setBoost(
  matchId: string,
  marketId: string,
  selectionId: string,
  ticks: number,
  reason: string | undefined,
): Promise<Boost> {
  const response = await authenticatedFetch('/admin/boosts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ matchId, marketId, selectionId, ticks, reason }),
  });
  return parseJsonOrThrow(response, `Failed to set boost: ${response.status}`);
}

export async function clearBoost(id: string): Promise<void> {
  const response = await authenticatedFetch(`/admin/boosts/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error(`Failed to clear boost: ${response.status}`);
  }
}

export async function setBoostLimits(id: string, input: SetLimitsInput): Promise<Boost> {
  const response = await authenticatedFetch(`/admin/boosts/${id}/limits`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseJsonOrThrow(response, `Failed to set boost limits: ${response.status}`);
}

export async function getHomepageCarouselConfig(): Promise<HomepageCarouselConfig> {
  const response = await authenticatedFetch('/admin/homepage-carousel-config');
  return parseJsonOrThrow(response, `Failed to load homepage carousel config: ${response.status}`);
}

export async function setHomepageCarouselConfig(config: HomepageCarouselConfig): Promise<HomepageCarouselConfig> {
  const response = await authenticatedFetch('/admin/homepage-carousel-config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return parseJsonOrThrow(response, `Failed to save homepage carousel config: ${response.status}`);
}

export async function getAccaBoostConfig(): Promise<AccaBoostConfig> {
  const response = await authenticatedFetch('/admin/acca-boost-config');
  return parseJsonOrThrow(response, `Failed to load acca boost config: ${response.status}`);
}

export async function setAccaBoostConfig(config: AccaBoostConfig): Promise<AccaBoostConfig> {
  const response = await authenticatedFetch('/admin/acca-boost-config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return parseJsonOrThrow(response, `Failed to save acca boost config: ${response.status}`);
}

export async function getAccaRollbackConfig(): Promise<AccaRollbackConfig> {
  const response = await authenticatedFetch('/admin/acca-rollback-config');
  return parseJsonOrThrow(response, `Failed to load acca rollback config: ${response.status}`);
}

export async function setAccaRollbackConfig(config: AccaRollbackConfig): Promise<AccaRollbackConfig> {
  const response = await authenticatedFetch('/admin/acca-rollback-config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return parseJsonOrThrow(response, `Failed to save acca rollback config: ${response.status}`);
}

export async function getInsuranceBetConfig(): Promise<InsuranceBetConfig> {
  const response = await authenticatedFetch('/admin/insurance-bet-config');
  return parseJsonOrThrow(response, `Failed to load insurance bet config: ${response.status}`);
}

export async function setInsuranceBetConfig(config: InsuranceBetConfig): Promise<InsuranceBetConfig> {
  const response = await authenticatedFetch('/admin/insurance-bet-config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return parseJsonOrThrow(response, `Failed to save insurance bet config: ${response.status}`);
}

function rangeQuery(range: ReportRange): string {
  const params = new URLSearchParams();
  if (range.from) params.set('from', range.from);
  if (range.to) params.set('to', range.to);
  const query = params.toString();
  return query ? `?${query}` : '';
}

export async function searchPlayers(query: string): Promise<PlayerSummary[]> {
  const params = new URLSearchParams();
  if (query) params.set('query', query);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const response = await authenticatedFetch(`/admin/players${suffix}`);
  return parseJsonOrThrow(response, `Failed to search players: ${response.status}`);
}

export async function getPlayerDetail(id: string): Promise<PlayerDetail> {
  const response = await authenticatedFetch(`/admin/players/${id}`);
  return parseJsonOrThrow(response, `Failed to load player: ${response.status}`);
}

export async function getLiveAnalytics(): Promise<LiveAnalyticsSnapshot> {
  const response = await authenticatedFetch('/admin/analytics/live');
  return parseJsonOrThrow(response, `Failed to load live analytics: ${response.status}`);
}

export async function getAnalyticsSummary(range: ReportRange): Promise<AnalyticsSummary> {
  const response = await authenticatedFetch(`/admin/analytics/summary${rangeQuery(range)}`);
  return parseJsonOrThrow(response, `Failed to load analytics summary: ${response.status}`);
}

export async function getReportSummary(range: ReportRange): Promise<ReportSummary> {
  const response = await authenticatedFetch(`/admin/reports/summary${rangeQuery(range)}`);
  return parseJsonOrThrow(response, `Failed to load report summary: ${response.status}`);
}

export async function getStaffActivity(range: ReportRange): Promise<StaffActivityEntry[]> {
  const response = await authenticatedFetch(`/admin/reports/staff-activity${rangeQuery(range)}`);
  return parseJsonOrThrow(response, `Failed to load staff activity: ${response.status}`);
}

function timeSeriesQuery(range: ReportRange, granularity: ReportGranularity): string {
  const params = new URLSearchParams();
  if (range.from) params.set('from', range.from);
  if (range.to) params.set('to', range.to);
  params.set('granularity', granularity);
  return `?${params.toString()}`;
}

export async function getRegistrationsTimeSeries(
  range: ReportRange,
  granularity: ReportGranularity,
): Promise<TimeSeriesPoint[]> {
  const response = await authenticatedFetch(
    `/admin/reports/registrations-time-series${timeSeriesQuery(range, granularity)}`,
  );
  return parseJsonOrThrow(response, `Failed to load registrations: ${response.status}`);
}

export async function getGgrTimeSeries(
  range: ReportRange,
  granularity: ReportGranularity,
): Promise<GgrTimeSeriesPoint[]> {
  const response = await authenticatedFetch(
    `/admin/reports/ggr-time-series${timeSeriesQuery(range, granularity)}`,
  );
  return parseJsonOrThrow(response, `Failed to load GGR: ${response.status}`);
}

export async function listTeamColors(): Promise<TeamColor[]> {
  const response = await authenticatedFetch('/admin/team-colors');
  return parseJsonOrThrow(response, `Failed to load team colors: ${response.status}`);
}

/** Existing names are left untouched - only genuinely new team names get created, with their color left unset. */
export async function syncTeamNames(names: string[]): Promise<TeamColor[]> {
  const response = await authenticatedFetch('/admin/team-colors/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ names }),
  });
  return parseJsonOrThrow(response, `Failed to sync team names: ${response.status}`);
}

/** Pass null to clear a previously-set color. */
export async function setTeamColor(id: string, colorHex: string | null): Promise<TeamColor> {
  const response = await authenticatedFetch(`/admin/team-colors/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ colorHex }),
  });
  return parseJsonOrThrow(response, `Failed to set team color: ${response.status}`);
}

export type DisplayNameEntityType =
  | 'SPORT'
  | 'COUNTRY'
  | 'COMPETITION'
  | 'TEAM'
  | 'MARKET'
  | 'SELECTION';

export interface DisplayNameOverride {
  id: string;
  entityType: DisplayNameEntityType;
  rawName: string;
  displayName: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function listDisplayNames(entityType: DisplayNameEntityType): Promise<DisplayNameOverride[]> {
  const response = await authenticatedFetch(`/admin/display-names?entityType=${entityType}`);
  return parseJsonOrThrow(response, `Failed to load display names: ${response.status}`);
}

/** Existing raw names are left untouched - only genuinely new ones for that entity type get created, with their override left unset. */
export async function syncDisplayNames(
  entityType: DisplayNameEntityType,
  names: string[],
): Promise<DisplayNameOverride[]> {
  const response = await authenticatedFetch('/admin/display-names/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entityType, names }),
  });
  return parseJsonOrThrow(response, `Failed to sync display names: ${response.status}`);
}

/** Pass null to clear a previously-set override, reverting to the raw feed name. */
export async function setDisplayName(id: string, displayName: string | null): Promise<DisplayNameOverride> {
  const response = await authenticatedFetch(`/admin/display-names/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName }),
  });
  return parseJsonOrThrow(response, `Failed to set display name: ${response.status}`);
}

export interface CompetitionRanking {
  id: string;
  brandId: string;
  competition: string;
  rank: number;
  createdAt: string;
  updatedAt: string;
}

export async function listCompetitionRankings(): Promise<CompetitionRanking[]> {
  const response = await authenticatedFetch('/admin/competition-rankings');
  return parseJsonOrThrow(response, `Failed to load competition rankings: ${response.status}`);
}

/** Idempotent - setting a rank for an already-ranked competition just updates it. */
export async function setCompetitionRanking(competition: string, rank: number): Promise<CompetitionRanking> {
  const response = await authenticatedFetch('/admin/competition-rankings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ competition, rank }),
  });
  return parseJsonOrThrow(response, `Failed to set competition ranking: ${response.status}`);
}

export async function removeCompetitionRanking(id: string): Promise<void> {
  const response = await authenticatedFetch(`/admin/competition-rankings/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to remove competition ranking: ${response.status}`);
  }
}

/**
 * A separate cross-sport curated list from CompetitionRanking above - this
 * one drives the player app sidebar's "Top Competitions" shortcut section
 * (can mix competitions from any sport), while CompetitionRanking orders
 * each sport's own competitions independently in the drill-down tree.
 */
export interface CompetitionQuicklink {
  id: string;
  brandId: string;
  competition: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export async function listCompetitionQuicklinks(): Promise<CompetitionQuicklink[]> {
  const response = await authenticatedFetch('/admin/competition-quicklinks');
  return parseJsonOrThrow(response, `Failed to load competition quicklinks: ${response.status}`);
}

/** Idempotent - setting an order for an already-listed competition just updates it. */
export async function setCompetitionQuicklink(competition: string, order: number): Promise<CompetitionQuicklink> {
  const response = await authenticatedFetch('/admin/competition-quicklinks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ competition, order }),
  });
  return parseJsonOrThrow(response, `Failed to set competition quicklink: ${response.status}`);
}

export async function removeCompetitionQuicklink(id: string): Promise<void> {
  const response = await authenticatedFetch(`/admin/competition-quicklinks/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to remove competition quicklink: ${response.status}`);
  }
}

export interface CompetitionTier {
  id: string;
  brandId: string;
  competition: string;
  tier: number;
  createdAt: string;
  updatedAt: string;
}

export async function listCompetitionTiers(): Promise<CompetitionTier[]> {
  const response = await authenticatedFetch('/admin/competition-tiers');
  return parseJsonOrThrow(response, `Failed to load competition tiers: ${response.status}`);
}

/** Idempotent - setting a tier for an already-tiered competition just updates it. */
export async function setCompetitionTier(competition: string, tier: number): Promise<CompetitionTier> {
  const response = await authenticatedFetch('/admin/competition-tiers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ competition, tier }),
  });
  return parseJsonOrThrow(response, `Failed to set competition tier: ${response.status}`);
}

export async function removeCompetitionTier(id: string): Promise<void> {
  const response = await authenticatedFetch(`/admin/competition-tiers/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to remove competition tier: ${response.status}`);
  }
}

export interface MarginConfig {
  id: string;
  brandId: string;
  sport: string;
  marketName: string;
  tier: number;
  marginPercent: number;
  createdAt: string;
  updatedAt: string;
}

export async function listMarginConfigs(): Promise<MarginConfig[]> {
  const response = await authenticatedFetch('/admin/margin-configs');
  return parseJsonOrThrow(response, `Failed to load margin configs: ${response.status}`);
}

/** Idempotent - setting a margin for an already-configured (sport, marketName, tier) triple just updates it. */
export async function setMarginConfig(
  sport: string,
  marketName: string,
  tier: number,
  marginPercent: number,
): Promise<MarginConfig> {
  const response = await authenticatedFetch('/admin/margin-configs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sport, marketName, tier, marginPercent }),
  });
  return parseJsonOrThrow(response, `Failed to set margin config: ${response.status}`);
}

export async function removeMarginConfig(id: string): Promise<void> {
  const response = await authenticatedFetch(`/admin/margin-configs/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to remove margin config: ${response.status}`);
  }
}

export interface MarketingSpend {
  id: string;
  brandId: string;
  date: string;
  channel: string;
  amountCents: number;
  createdByUsername: string;
  createdAt: string;
}

export async function listMarketingSpend(range: ReportRange = {}): Promise<MarketingSpend[]> {
  const response = await authenticatedFetch(`/admin/marketing-spend${rangeQuery(range)}`);
  return parseJsonOrThrow(response, `Failed to load marketing spend: ${response.status}`);
}

export async function createMarketingSpend(
  date: string,
  channel: string,
  amountCents: number,
): Promise<MarketingSpend> {
  const response = await authenticatedFetch('/admin/marketing-spend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, channel, amountCents }),
  });
  return parseJsonOrThrow(response, `Failed to record marketing spend: ${response.status}`);
}

export async function removeMarketingSpend(id: string): Promise<void> {
  const response = await authenticatedFetch(`/admin/marketing-spend/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to remove marketing spend: ${response.status}`);
  }
}

export type BrandImageSlot = 'REGISTER_DESKTOP' | 'REGISTER_MOBILE' | 'HOMEPAGE_OFFER' | 'MATCH_OF_THE_DAY';

export interface BrandImage {
  id: string;
  brandId: string;
  slot: BrandImageSlot;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
}

export async function listBrandImages(): Promise<BrandImage[]> {
  const response = await authenticatedFetch('/admin/brand-images');
  return parseJsonOrThrow(response, `Failed to load brand images: ${response.status}`);
}

/** Idempotent - uploading to an already-set slot replaces it. No Content-Type header set - fetch derives the multipart boundary itself from the FormData body. */
export async function uploadBrandImage(slot: BrandImageSlot, file: File): Promise<BrandImage> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await authenticatedFetch(`/admin/brand-images/${slot}`, {
    method: 'POST',
    body: formData,
  });
  return parseJsonOrThrow(response, `Failed to upload image: ${response.status}`);
}

export async function removeBrandImage(slot: BrandImageSlot): Promise<void> {
  const response = await authenticatedFetch(`/admin/brand-images/${slot}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to remove brand image: ${response.status}`);
  }
}

export type BrandImageListKind = 'SPONSOR_LOGO' | 'PAYMENT_METHOD';

export interface BrandImageListItem {
  id: string;
  brandId: string;
  kind: BrandImageListKind;
  mimeType: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export async function listBrandImageList(kind: BrandImageListKind): Promise<BrandImageListItem[]> {
  const response = await authenticatedFetch(`/admin/brand-image-list?kind=${kind}`);
  return parseJsonOrThrow(response, `Failed to load images: ${response.status}`);
}

/** No Content-Type header set - fetch derives the multipart boundary itself from the FormData body. */
export async function addBrandImageListItem(
  kind: BrandImageListKind,
  file: File,
): Promise<BrandImageListItem> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await authenticatedFetch(`/admin/brand-image-list/${kind}`, {
    method: 'POST',
    body: formData,
  });
  return parseJsonOrThrow(response, `Failed to upload image: ${response.status}`);
}

export async function removeBrandImageListItem(id: string): Promise<void> {
  const response = await authenticatedFetch(`/admin/brand-image-list/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to remove image: ${response.status}`);
  }
}

/** `ids` must be exactly the current set of items for this kind, in the desired order. */
export async function reorderBrandImageList(
  kind: BrandImageListKind,
  ids: string[],
): Promise<BrandImageListItem[]> {
  const response = await authenticatedFetch(`/admin/brand-image-list/${kind}/reorder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  return parseJsonOrThrow(response, `Failed to reorder images: ${response.status}`);
}

export type LimitScope = 'GLOBAL' | 'SPORT' | 'COUNTRY' | 'LEAGUE' | 'MARKET';

export interface StakeLimit {
  id: string;
  brandId: string;
  scope: LimitScope;
  scopeValue: string;
  tier: number;
  maxStakeCents: number | null;
  maxLiabilityCents: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface StakeLimitInput {
  scope: LimitScope;
  scopeValue: string;
  tier: number;
  maxStakeCents: number | null;
  maxLiabilityCents: number | null;
}

export async function listStakeLimits(): Promise<StakeLimit[]> {
  const response = await authenticatedFetch('/admin/stake-limits');
  return parseJsonOrThrow(response, `Failed to load stake limits: ${response.status}`);
}

/** Idempotent - setting a limit for an already-configured (scope, scopeValue, tier) triple just updates it. */
export async function setStakeLimit(input: StakeLimitInput): Promise<StakeLimit> {
  const response = await authenticatedFetch('/admin/stake-limits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseJsonOrThrow(response, `Failed to set stake limit: ${response.status}`);
}

export async function removeStakeLimit(id: string): Promise<void> {
  const response = await authenticatedFetch(`/admin/stake-limits/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to remove stake limit: ${response.status}`);
  }
}

export async function exportStakeLimits(): Promise<Blob> {
  const response = await authenticatedFetch('/admin/stake-limits/export');
  if (!response.ok) {
    throw new Error(`Failed to export stake limits: ${response.status}`);
  }
  return response.blob();
}

export interface StakeLimitImportResult {
  count: number;
  removedCount: number;
}

/** No Content-Type header set - fetch derives the multipart boundary itself from the FormData body. The uploaded file replaces the brand's whole limit set. */
export async function importStakeLimits(file: File): Promise<StakeLimitImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await authenticatedFetch('/admin/stake-limits/import', {
    method: 'POST',
    body: formData,
  });
  return parseJsonOrThrow(response, `Failed to import stake limits: ${response.status}`);
}

export type AudienceMode = 'ALL' | 'LOGGED_OUT' | 'LOGGED_IN' | 'SEGMENTS';

export interface PlayerSegmentMember {
  id: string;
  userId: string;
  addedAt: string;
  user: { id: string; email: string; username: string };
}

export interface PlayerSegment {
  id: string;
  brandId: string;
  name: string;
  description: string | null;
  colorHex: string | null;
  createdAt: string;
  updatedAt: string;
  members: PlayerSegmentMember[];
}

export async function listPlayerSegments(): Promise<PlayerSegment[]> {
  const response = await authenticatedFetch('/admin/player-segments');
  return parseJsonOrThrow(response, `Failed to load player segments: ${response.status}`);
}

export async function createPlayerSegment(name: string, description?: string): Promise<PlayerSegment> {
  const response = await authenticatedFetch('/admin/player-segments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description }),
  });
  return parseJsonOrThrow(response, `Failed to create player segment: ${response.status}`);
}

/** Pass null to clear a previously-set color. Purely a CRM organizing aid - see PlayerSegment.colorHex. */
export async function setPlayerSegmentColor(id: string, colorHex: string | null): Promise<PlayerSegment> {
  const response = await authenticatedFetch(`/admin/player-segments/${id}/color`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ colorHex }),
  });
  return parseJsonOrThrow(response, `Failed to set segment color: ${response.status}`);
}

export async function removePlayerSegment(id: string): Promise<void> {
  const response = await authenticatedFetch(`/admin/player-segments/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error(`Failed to remove player segment: ${response.status}`);
  }
}

/** `identifier` is the player's email or username - whichever staff has on hand. */
export async function addPlayerSegmentMember(segmentId: string, identifier: string): Promise<PlayerSegmentMember> {
  const response = await authenticatedFetch(`/admin/player-segments/${segmentId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier }),
  });
  return parseJsonOrThrow(response, `Failed to add player to segment: ${response.status}`);
}

export async function removePlayerSegmentMember(segmentId: string, userId: string): Promise<void> {
  const response = await authenticatedFetch(`/admin/player-segments/${segmentId}/members/${userId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to remove player from segment: ${response.status}`);
  }
}

export type FreebetStatus = 'ACTIVE' | 'SPENT' | 'VOIDED';
export type FreebetSource = 'MANUAL' | 'ACCA_ROLLBACK' | 'INSURANCE_BET';

export interface FreebetGrant {
  id: string;
  userId: string;
  brandId: string;
  amountCents: number;
  /** How much of amountCents hasn't been drawn down by a freebet-funded bet yet - what's actually still spendable from this grant. */
  remainingCents: number;
  source: FreebetSource;
  note: string | null;
  status: FreebetStatus;
  expiresAt: string | null;
  spentAt: string | null;
  voidedAt: string | null;
  createdByStaffUserId: string | null;
  createdByUsername: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GrantFreebetPayload {
  identifier: string;
  amountCents: number;
  note?: string;
  expiresAt?: string;
}

/** `identifier` is the player's email or username - whichever staff has on hand. */
export async function listFreebets(identifier: string): Promise<FreebetGrant[]> {
  const response = await authenticatedFetch(`/admin/freebets/${encodeURIComponent(identifier)}`);
  return parseJsonOrThrow(response, `Failed to load freebets: ${response.status}`);
}

export async function grantFreebet(payload: GrantFreebetPayload): Promise<FreebetGrant> {
  const response = await authenticatedFetch('/admin/freebets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(response, `Failed to grant freebet: ${response.status}`);
}

export async function voidFreebet(id: string): Promise<FreebetGrant> {
  const response = await authenticatedFetch(`/admin/freebets/${id}`, { method: 'DELETE' });
  return parseJsonOrThrow(response, `Failed to void freebet: ${response.status}`);
}

export type BetAndGetTrigger = 'PLACEMENT' | 'SETTLEMENT';
export type BetAndGetBetType = 'SINGLES_ONLY' | 'ACCUMULATOR_ONLY' | 'EITHER';
export type BetAndGetTiming = 'PREMATCH_ONLY' | 'INPLAY_ONLY' | 'EITHER';
export type BetAndGetScopeType = 'SPORT' | 'COMPETITION' | 'MATCH';
export type BetAndGetRewardType = 'FIXED' | 'PERCENTAGE';

export interface BetAndGetCampaignScope {
  id: string;
  scopeType: BetAndGetScopeType;
  scopeValue: string;
}

export interface BetAndGetCampaignSegment {
  id: string;
  campaignId: string;
  segmentId: string;
}

export interface BetAndGetCampaign {
  id: string;
  brandId: string;
  name: string;
  description: string | null;
  enabled: boolean;
  /** Optional scheduling window, both independently optional - null means no boundary on that side. */
  startAt: string | null;
  endAt: string | null;
  /** FIXED = same rewardAmountCents every time; PERCENTAGE = rewardPercent of the qualifying bet's own stake, capped at rewardCapCents. */
  rewardType: BetAndGetRewardType;
  /** Set when rewardType is FIXED, null otherwise. */
  rewardAmountCents: number | null;
  /** Set when rewardType is PERCENTAGE, null otherwise. */
  rewardPercent: number | null;
  /** Set when rewardType is PERCENTAGE, null otherwise. */
  rewardCapCents: number | null;
  trigger: BetAndGetTrigger;
  triggerOnWon: boolean;
  triggerOnLost: boolean;
  triggerOnVoid: boolean;
  minStakeCents: number | null;
  minOddsPerLeg: number | null;
  /** Combined/accumulator price (product of all legs' odds), distinct from minOddsPerLeg's per-leg floor. */
  minCombinedOdds: number | null;
  betType: BetAndGetBetType;
  minSelections: number | null;
  /** Restricts which selections' matches can qualify by whether they'd already kicked off at bet placement. */
  bettingTiming: BetAndGetTiming;
  allowMultipleRedemptions: boolean;
  maxRedemptionsPerPlayer: number | null;
  audienceMode: AudienceMode;
  segments: BetAndGetCampaignSegment[];
  createdAt: string;
  updatedAt: string;
  scopes: BetAndGetCampaignScope[];
}

export interface CreateBetAndGetCampaignPayload {
  name: string;
  description?: string;
  startAt?: string | null;
  endAt?: string | null;
  rewardType?: BetAndGetRewardType;
  /** Required when rewardType is FIXED. */
  rewardAmountCents?: number;
  /** Required when rewardType is PERCENTAGE. */
  rewardPercent?: number;
  /** Required when rewardType is PERCENTAGE. */
  rewardCapCents?: number;
}

export type UpdateBetAndGetCampaignPayload = Partial<
  Omit<BetAndGetCampaign, 'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'scopes' | 'segments'> & {
    segmentIds: string[];
  }
>;

export async function listBetAndGetCampaigns(): Promise<BetAndGetCampaign[]> {
  const response = await authenticatedFetch('/admin/bet-and-get-campaigns');
  return parseJsonOrThrow(response, `Failed to load Bet & Get campaigns: ${response.status}`);
}

export async function createBetAndGetCampaign(payload: CreateBetAndGetCampaignPayload): Promise<BetAndGetCampaign> {
  const response = await authenticatedFetch('/admin/bet-and-get-campaigns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(response, `Failed to create Bet & Get campaign: ${response.status}`);
}

export async function updateBetAndGetCampaign(
  id: string,
  payload: UpdateBetAndGetCampaignPayload,
): Promise<BetAndGetCampaign> {
  const response = await authenticatedFetch(`/admin/bet-and-get-campaigns/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(response, `Failed to update Bet & Get campaign: ${response.status}`);
}

export async function removeBetAndGetCampaign(id: string): Promise<void> {
  const response = await authenticatedFetch(`/admin/bet-and-get-campaigns/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error(`Failed to remove Bet & Get campaign: ${response.status}`);
  }
}

export async function setBetAndGetCampaignScopes(
  id: string,
  scopes: { scopeType: BetAndGetScopeType; scopeValue: string }[],
): Promise<BetAndGetCampaign> {
  const response = await authenticatedFetch(`/admin/bet-and-get-campaigns/${id}/scopes`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scopes }),
  });
  return parseJsonOrThrow(response, `Failed to set Bet & Get campaign scope: ${response.status}`);
}

export type DepositRewardType = 'FIXED' | 'PERCENTAGE';

export interface DepositCampaignSegment {
  id: string;
  depositCampaignId: string;
  segmentId: string;
}

export interface DepositCampaign {
  id: string;
  brandId: string;
  name: string;
  description: string | null;
  enabled: boolean;
  /** Optional scheduling window, both independently optional - null means no boundary on that side. */
  startAt: string | null;
  endAt: string | null;
  minDepositAmountCents: number;
  rewardType: DepositRewardType;
  fixedRewardAmountCents: number | null;
  rewardPercent: number | null;
  rewardCapCents: number | null;
  requiresBet: boolean;
  trigger: BetAndGetTrigger;
  triggerOnWon: boolean;
  triggerOnLost: boolean;
  triggerOnVoid: boolean;
  minStakeCents: number | null;
  minOddsPerLeg: number | null;
  betType: BetAndGetBetType;
  minSelections: number | null;
  allowMultipleRedemptions: boolean;
  maxRedemptionsPerPlayer: number | null;
  audienceMode: AudienceMode;
  segments: DepositCampaignSegment[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateDepositCampaignPayload {
  name: string;
  description?: string;
  startAt?: string | null;
  endAt?: string | null;
  minDepositAmountCents: number;
  rewardType: DepositRewardType;
  /** Required when rewardType is FIXED. */
  fixedRewardAmountCents?: number;
  /** Required (both) when rewardType is PERCENTAGE. */
  rewardPercent?: number;
  rewardCapCents?: number;
}

export type UpdateDepositCampaignPayload = Partial<
  Omit<DepositCampaign, 'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'segments'> & { segmentIds: string[] }
>;

export async function listDepositCampaigns(): Promise<DepositCampaign[]> {
  const response = await authenticatedFetch('/admin/deposit-campaigns');
  return parseJsonOrThrow(response, `Failed to load deposit campaigns: ${response.status}`);
}

export async function createDepositCampaign(payload: CreateDepositCampaignPayload): Promise<DepositCampaign> {
  const response = await authenticatedFetch('/admin/deposit-campaigns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(response, `Failed to create deposit campaign: ${response.status}`);
}

export async function updateDepositCampaign(
  id: string,
  payload: UpdateDepositCampaignPayload,
): Promise<DepositCampaign> {
  const response = await authenticatedFetch(`/admin/deposit-campaigns/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(response, `Failed to update deposit campaign: ${response.status}`);
}

export async function removeDepositCampaign(id: string): Promise<void> {
  const response = await authenticatedFetch(`/admin/deposit-campaigns/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error(`Failed to remove deposit campaign: ${response.status}`);
  }
}

export interface RegisterCampaignSegment {
  id: string;
  registerCampaignId: string;
  segmentId: string;
}

export interface RegisterCampaign {
  id: string;
  brandId: string;
  name: string;
  description: string | null;
  enabled: boolean;
  startAt: string | null;
  endAt: string | null;
  rewardType: BetAndGetRewardType;
  rewardAmountCents: number | null;
  rewardPercent: number | null;
  rewardCapCents: number | null;
  /** false = the reward is granted the instant registration completes; true = it's deferred to a qualifying bet placed within qualifyingBetWindowDays of signup. */
  requiresBet: boolean;
  /** Required when requiresBet is true. */
  qualifyingBetWindowDays: number | null;
  trigger: BetAndGetTrigger;
  triggerOnWon: boolean;
  triggerOnLost: boolean;
  triggerOnVoid: boolean;
  minStakeCents: number | null;
  minOddsPerLeg: number | null;
  betType: BetAndGetBetType;
  minSelections: number | null;
  audienceMode: AudienceMode;
  segments: RegisterCampaignSegment[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateRegisterCampaignPayload {
  name: string;
  description?: string;
  startAt?: string | null;
  endAt?: string | null;
  rewardType?: BetAndGetRewardType;
  rewardAmountCents?: number;
  rewardPercent?: number;
  rewardCapCents?: number;
  requiresBet?: boolean;
  qualifyingBetWindowDays?: number;
}

export type UpdateRegisterCampaignPayload = Partial<
  Omit<RegisterCampaign, 'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'segments'> & { segmentIds: string[] }
>;

export async function listRegisterCampaigns(): Promise<RegisterCampaign[]> {
  const response = await authenticatedFetch('/admin/register-campaigns');
  return parseJsonOrThrow(response, `Failed to load Register campaigns: ${response.status}`);
}

export async function createRegisterCampaign(payload: CreateRegisterCampaignPayload): Promise<RegisterCampaign> {
  const response = await authenticatedFetch('/admin/register-campaigns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(response, `Failed to create Register campaign: ${response.status}`);
}

export async function updateRegisterCampaign(
  id: string,
  payload: UpdateRegisterCampaignPayload,
): Promise<RegisterCampaign> {
  const response = await authenticatedFetch(`/admin/register-campaigns/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(response, `Failed to update Register campaign: ${response.status}`);
}

export async function removeRegisterCampaign(id: string): Promise<void> {
  const response = await authenticatedFetch(`/admin/register-campaigns/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error(`Failed to remove Register campaign: ${response.status}`);
  }
}

export interface LeaderboardCampaignSegment {
  id: string;
  leaderboardCampaignId: string;
  segmentId: string;
}

export interface LeaderboardCampaignScope {
  id: string;
  scopeType: BetAndGetScopeType;
  scopeValue: string;
}

export interface LeaderboardRewardTier {
  id: string;
  rankFrom: number;
  rankTo: number;
  rewardAmountCents: number;
}

export interface LeaderboardCampaign {
  id: string;
  brandId: string;
  name: string;
  description: string | null;
  enabled: boolean;
  startAt: string | null;
  /** Required - a leaderboard needs a definite end to rank against and grant prizes at. */
  endAt: string;
  pointsPerEuroStaked: number;
  useCombinedOddsAsMultiplier: boolean;
  /** true = only bets that settle WON earn points; false = every settled outcome that still qualifies earns points. */
  onlySettledWonCounts: boolean;
  minStakeCents: number | null;
  minOddsPerLeg: number | null;
  minCombinedOdds: number | null;
  betType: BetAndGetBetType;
  minSelections: number | null;
  bettingTiming: BetAndGetTiming;
  audienceMode: AudienceMode;
  segments: LeaderboardCampaignSegment[];
  scopes: LeaderboardCampaignScope[];
  rewardTiers: LeaderboardRewardTier[];
  /** Set once prizes have been granted (see finalizeLeaderboardCampaign) - null until then. */
  prizesGrantedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeaderboardCampaignPayload {
  name: string;
  description?: string;
  startAt?: string | null;
  endAt: string;
  pointsPerEuroStaked?: number;
  useCombinedOddsAsMultiplier?: boolean;
  onlySettledWonCounts?: boolean;
  minStakeCents?: number;
  minOddsPerLeg?: number;
  minCombinedOdds?: number;
  betType?: BetAndGetBetType;
  minSelections?: number;
  bettingTiming?: BetAndGetTiming;
}

export type UpdateLeaderboardCampaignPayload = Partial<
  Omit<LeaderboardCampaign, 'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'segments' | 'scopes' | 'rewardTiers'> & {
    segmentIds: string[];
  }
>;

export interface LeaderboardEntryForStaff {
  id: string;
  userId: string;
  pointsTotal: number;
  joinedAt: string;
  user: { id: string; username: string };
}

export async function listLeaderboardCampaigns(): Promise<LeaderboardCampaign[]> {
  const response = await authenticatedFetch('/admin/leaderboard-campaigns');
  return parseJsonOrThrow(response, `Failed to load Leaderboard campaigns: ${response.status}`);
}

export async function createLeaderboardCampaign(
  payload: CreateLeaderboardCampaignPayload,
): Promise<LeaderboardCampaign> {
  const response = await authenticatedFetch('/admin/leaderboard-campaigns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(response, `Failed to create Leaderboard campaign: ${response.status}`);
}

export async function updateLeaderboardCampaign(
  id: string,
  payload: UpdateLeaderboardCampaignPayload,
): Promise<LeaderboardCampaign> {
  const response = await authenticatedFetch(`/admin/leaderboard-campaigns/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(response, `Failed to update Leaderboard campaign: ${response.status}`);
}

export async function removeLeaderboardCampaign(id: string): Promise<void> {
  const response = await authenticatedFetch(`/admin/leaderboard-campaigns/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error(`Failed to remove Leaderboard campaign: ${response.status}`);
  }
}

export async function setLeaderboardCampaignScopes(
  id: string,
  scopes: { scopeType: BetAndGetScopeType; scopeValue: string }[],
): Promise<LeaderboardCampaign> {
  const response = await authenticatedFetch(`/admin/leaderboard-campaigns/${id}/scopes`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scopes }),
  });
  return parseJsonOrThrow(response, `Failed to set Leaderboard campaign scope: ${response.status}`);
}

export async function setLeaderboardRewardTiers(
  id: string,
  tiers: { rankFrom: number; rankTo: number; rewardAmountCents: number }[],
): Promise<LeaderboardCampaign> {
  const response = await authenticatedFetch(`/admin/leaderboard-campaigns/${id}/reward-tiers`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tiers }),
  });
  return parseJsonOrThrow(response, `Failed to set Leaderboard campaign reward tiers: ${response.status}`);
}

export async function finalizeLeaderboardCampaign(id: string): Promise<LeaderboardCampaign> {
  const response = await authenticatedFetch(`/admin/leaderboard-campaigns/${id}/finalize`, { method: 'POST' });
  return parseJsonOrThrow(response, `Failed to finalize Leaderboard campaign: ${response.status}`);
}

export async function getLeaderboardCampaignEntries(id: string): Promise<LeaderboardEntryForStaff[]> {
  const response = await authenticatedFetch(`/admin/leaderboard-campaigns/${id}/entries`);
  return parseJsonOrThrow(response, `Failed to load Leaderboard campaign entries: ${response.status}`);
}

export interface PromoCard {
  id: string;
  brandId: string;
  /** Null for an auto-created card staff hasn't uploaded artwork for yet - see PromoCardAutoSyncService. */
  mimeType: string | null;
  title: string | null;
  subtitle: string | null;
  sortOrder: number;
  autoCreated: boolean;
  betAndGetCampaignId: string | null;
  depositCampaignId: string | null;
  registerCampaignId: string | null;
  leaderboardCampaignId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AddPromoCardPayload {
  file: File;
  title?: string;
  subtitle?: string;
  betAndGetCampaignId?: string;
  depositCampaignId?: string;
  registerCampaignId?: string;
  leaderboardCampaignId?: string;
}

export interface UpdatePromoCardPayload {
  title?: string | null;
  subtitle?: string | null;
  betAndGetCampaignId?: string | null;
  depositCampaignId?: string | null;
  registerCampaignId?: string | null;
  leaderboardCampaignId?: string | null;
}

export async function listPromoCards(): Promise<PromoCard[]> {
  const response = await authenticatedFetch('/admin/promo-cards');
  return parseJsonOrThrow(response, `Failed to load promo cards: ${response.status}`);
}

/** No Content-Type header set - fetch derives the multipart boundary itself from the FormData body. */
export async function addPromoCard(payload: AddPromoCardPayload): Promise<PromoCard> {
  const formData = new FormData();
  formData.append('file', payload.file);
  if (payload.title) formData.append('title', payload.title);
  if (payload.subtitle) formData.append('subtitle', payload.subtitle);
  if (payload.betAndGetCampaignId) formData.append('betAndGetCampaignId', payload.betAndGetCampaignId);
  if (payload.depositCampaignId) formData.append('depositCampaignId', payload.depositCampaignId);
  if (payload.registerCampaignId) formData.append('registerCampaignId', payload.registerCampaignId);
  if (payload.leaderboardCampaignId) formData.append('leaderboardCampaignId', payload.leaderboardCampaignId);
  const response = await authenticatedFetch('/admin/promo-cards', { method: 'POST', body: formData });
  return parseJsonOrThrow(response, `Failed to upload promo card: ${response.status}`);
}

export async function updatePromoCard(id: string, payload: UpdatePromoCardPayload): Promise<PromoCard> {
  const response = await authenticatedFetch(`/admin/promo-cards/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(response, `Failed to update promo card: ${response.status}`);
}

/** Sets/replaces just a card's image - the only way to give an auto-created card its first piece of artwork. */
export async function updatePromoCardImage(id: string, file: File): Promise<PromoCard> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await authenticatedFetch(`/admin/promo-cards/${id}/image`, { method: 'POST', body: formData });
  return parseJsonOrThrow(response, `Failed to update promo card image: ${response.status}`);
}

export async function removePromoCard(id: string): Promise<void> {
  const response = await authenticatedFetch(`/admin/promo-cards/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error(`Failed to remove promo card: ${response.status}`);
  }
}

/** `ids` must be exactly the current set of promo cards, in the desired order. */
export async function reorderPromoCards(ids: string[]): Promise<PromoCard[]> {
  const response = await authenticatedFetch('/admin/promo-cards/reorder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  return parseJsonOrThrow(response, `Failed to reorder promo cards: ${response.status}`);
}

export interface MatchOfTheDayEntry {
  id: string;
  brandId: string;
  matchId: string;
  sortOrder: number;
  enabled: boolean;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AddMatchOfTheDayPayload {
  matchId: string;
  enabled?: boolean;
  startAt?: string | null;
  endAt?: string | null;
}

export interface UpdateMatchOfTheDayPayload {
  matchId?: string;
  enabled?: boolean;
  startAt?: string | null;
  endAt?: string | null;
}

export async function listMatchOfTheDay(): Promise<MatchOfTheDayEntry[]> {
  const response = await authenticatedFetch('/admin/match-of-the-day');
  return parseJsonOrThrow(response, `Failed to load Match of the day entries: ${response.status}`);
}

export async function addMatchOfTheDay(payload: AddMatchOfTheDayPayload): Promise<MatchOfTheDayEntry> {
  const response = await authenticatedFetch('/admin/match-of-the-day', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(response, `Failed to add Match of the day entry: ${response.status}`);
}

export async function updateMatchOfTheDay(id: string, payload: UpdateMatchOfTheDayPayload): Promise<MatchOfTheDayEntry> {
  const response = await authenticatedFetch(`/admin/match-of-the-day/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(response, `Failed to update Match of the day entry: ${response.status}`);
}

export async function removeMatchOfTheDay(id: string): Promise<void> {
  const response = await authenticatedFetch(`/admin/match-of-the-day/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error(`Failed to remove Match of the day entry: ${response.status}`);
  }
}

/** `ids` must be exactly the current set of Match of the day entries, in the desired order. */
export async function reorderMatchOfTheDay(ids: string[]): Promise<MatchOfTheDayEntry[]> {
  const response = await authenticatedFetch('/admin/match-of-the-day/reorder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  return parseJsonOrThrow(response, `Failed to reorder Match of the day entries: ${response.status}`);
}

export type TopNavItemKind = 'SPORT' | 'COMPETITION' | 'MATCH' | 'TODAY' | 'TOMORROW';

export interface TopNavItem {
  id: string;
  brandId: string;
  kind: TopNavItemKind;
  label: string;
  icon: TopNavIconKey;
  sport: string | null;
  competition: string | null;
  matchId: string | null;
  sortOrder: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTopNavItemPayload {
  kind: TopNavItemKind;
  label: string;
  icon: TopNavIconKey;
  sport?: string;
  competition?: string;
  matchId?: string;
  enabled?: boolean;
}

export interface UpdateTopNavItemPayload {
  kind?: TopNavItemKind;
  label?: string;
  icon?: TopNavIconKey;
  sport?: string;
  competition?: string;
  matchId?: string;
  enabled?: boolean;
}

export async function listTopNavItems(): Promise<TopNavItem[]> {
  const response = await authenticatedFetch('/admin/top-nav');
  return parseJsonOrThrow(response, `Failed to load top nav items: ${response.status}`);
}

export async function addTopNavItem(payload: CreateTopNavItemPayload): Promise<TopNavItem> {
  const response = await authenticatedFetch('/admin/top-nav', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(response, `Failed to add top nav item: ${response.status}`);
}

export async function updateTopNavItem(id: string, payload: UpdateTopNavItemPayload): Promise<TopNavItem> {
  const response = await authenticatedFetch(`/admin/top-nav/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(response, `Failed to update top nav item: ${response.status}`);
}

export async function removeTopNavItem(id: string): Promise<void> {
  const response = await authenticatedFetch(`/admin/top-nav/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error(`Failed to remove top nav item: ${response.status}`);
  }
}

/** `ids` must be exactly the current set of top nav items, in the desired order. */
export async function reorderTopNavItems(ids: string[]): Promise<TopNavItem[]> {
  const response = await authenticatedFetch('/admin/top-nav/reorder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  return parseJsonOrThrow(response, `Failed to reorder top nav items: ${response.status}`);
}

export type PushNotificationKind = 'CUSTOM' | 'BET_WON' | 'BET_AND_GET_CAMPAIGN' | 'DEPOSIT_CAMPAIGN';
export type PushDeliveryStatus = 'SENT' | 'FAILED';

export interface PushNotification {
  id: string;
  kind: PushNotificationKind;
  title: string;
  body: string;
  targetUrl: string | null;
  audienceMode: AudienceMode;
  betAndGetCampaignId: string | null;
  depositCampaignId: string | null;
  sourceBetId: string | null;
  ttlSeconds: number;
  sentByStaffUserId: string | null;
  sentByUsername: string | null;
  createdAt: string;
  _count: { recipients: number };
}

export interface PushNotificationRecipient {
  id: string;
  userId: string;
  endpoint: string;
  status: PushDeliveryStatus;
  statusCode: number | null;
  errorMessage: string | null;
  sentAt: string;
  user: { username: string };
}

export interface PushNotificationDetail extends Omit<PushNotification, '_count'> {
  recipients: PushNotificationRecipient[];
}

export interface SendPushNotificationInput {
  title: string;
  body: string;
  targetUrl?: string;
  audienceMode?: AudienceMode;
  segmentIds?: string[];
  betAndGetCampaignId?: string;
  depositCampaignId?: string;
}

export async function listPushNotifications(): Promise<PushNotification[]> {
  const response = await authenticatedFetch('/admin/push-notifications');
  return parseJsonOrThrow(response, `Failed to load push notifications: ${response.status}`);
}

export async function getPushNotification(id: string): Promise<PushNotificationDetail> {
  const response = await authenticatedFetch(`/admin/push-notifications/${id}`);
  return parseJsonOrThrow(response, `Failed to load push notification: ${response.status}`);
}

export async function sendPushNotification(input: SendPushNotificationInput): Promise<PushNotification> {
  const response = await authenticatedFetch('/admin/push-notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseJsonOrThrow(response, `Failed to send push notification: ${response.status}`);
}
