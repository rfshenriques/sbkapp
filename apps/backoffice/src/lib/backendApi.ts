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
  reason: string | null;
  createdAt: string;
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

export async function listBets(status?: BetStatus): Promise<Bet[]> {
  const query = status ? `?status=${status}` : '';
  const response = await authenticatedFetch(`/admin/bets${query}`);
  return parseJsonOrThrow(response, `Failed to load bets: ${response.status}`);
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
  reason: string | undefined,
): Promise<MarketSuspension> {
  const response = await authenticatedFetch('/admin/market-suspensions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ matchId, marketId, reason }),
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

function rangeQuery(range: ReportRange): string {
  const params = new URLSearchParams();
  if (range.from) params.set('from', range.from);
  if (range.to) params.set('to', range.to);
  const query = params.toString();
  return query ? `?${query}` : '';
}

export async function getReportSummary(range: ReportRange): Promise<ReportSummary> {
  const response = await authenticatedFetch(`/admin/reports/summary${rangeQuery(range)}`);
  return parseJsonOrThrow(response, `Failed to load report summary: ${response.status}`);
}

export async function getStaffActivity(range: ReportRange): Promise<StaffActivityEntry[]> {
  const response = await authenticatedFetch(`/admin/reports/staff-activity${rangeQuery(range)}`);
  return parseJsonOrThrow(response, `Failed to load staff activity: ${response.status}`);
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
