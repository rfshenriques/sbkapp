import type { BoostedSelectionSummary, Match } from '@sportsbook/shared';
import { useAuthStore } from '../features/auth/authStore';
import { useBrandStore } from '../features/brand/brandStore';

const BASE_URL = '/backend';

/**
 * Public match/specials/boosts endpoints work fine with no token (anonymous
 * browsing), but attach one when a player is logged in so the backend's
 * ViewerResolverService can resolve LOGGED_IN/SEGMENTS audience targeting
 * (see ManualMarketService/BoostService.mergeIntoMatches/applyBoosts)
 * instead of always seeing an anonymous viewer.
 */
function optionalAuthHeaders(): HeadersInit {
  const token = useAuthStore.getState().accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface AuthTokenResponse {
  accessToken: string;
}

export interface RegisterPayload {
  email: string;
  username: string;
  phone: string;
  password: string;
  referrerUrl?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

export interface LoginPayload {
  identifier: string;
  password: string;
}

export interface Wallet {
  balanceCents: number;
}

export interface PlaceBetSelection {
  matchId: string;
  marketId: string;
  selectionId: string;
  matchLabel: string;
  marketName: string;
  selectionName: string;
  odds: number;
}

export interface PlaceBetPayload {
  selections: PlaceBetSelection[];
  stakeCents: number;
  /** Funds this bet with a freebet instead of cash - stakeCents must equal that grant's amountCents exactly (see FreebetService). */
  freebetGrantId?: string;
  /** Opts into insurance (see InsuranceBetService) - reduces the payout by the brand's cost percent, refunds the stake as a freebet if the bet loses. Never applies alongside freebetGrantId. */
  insuranceOptIn?: boolean;
}

/** A player's own freebet token - always ACTIVE and unexpired (see PamService.getFreebets/FreebetService.listActive), since that's all a player ever needs to see to place a bet with one. */
export interface Freebet {
  id: string;
  amountCents: number;
  expiresAt: string | null;
}

export type BetStatus = 'PENDING' | 'WON' | 'LOST' | 'VOID';
export type SelectionStatus = 'OPEN' | 'WON' | 'LOST' | 'VOID';

export interface PlacedBetSelection {
  id: string;
  matchId: string;
  marketId: string;
  selectionId: string;
  matchLabel: string;
  marketName: string;
  selectionName: string;
  odds: string;
  status: SelectionStatus;
}

export interface PlacedBet {
  id: string;
  stakeCents: number;
  combinedOdds: string;
  potentialPayoutCents: number;
  status: BetStatus;
  settledPayoutCents: number | null;
  settledAt: string | null;
  createdAt: string;
  selections: PlacedBetSelection[];
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

/**
 * Local-dev/CI fallback only - see getPublicBrand. One running apps/frontend
 * deployment now serves many brands' domains (see PROJECT_BRIEF.md Section
 * 10's domain-based brand resolution), so this env var is no longer "which
 * brand does this deployment belong to." It only matters when the current
 * hostname (e.g. localhost) has no brand configured for it.
 */
const FALLBACK_BRAND_ID = import.meta.env.VITE_BRAND_ID as string | undefined;

export interface PublicBrand {
  id: string;
  name: string;
  logoUrl: string | null;
  themeMode: 'LIGHT' | 'DARK';
  buttonColorHex: string | null;
  highlightColorHex: string | null;
  filterColorHex: string | null;
  supportHelplineText: string | null;
}

/**
 * Every player belongs to exactly one brand (see PROJECT_BRIEF.md Section
 * 10's brandId retrofit). Resolves it from the hostname the app is actually
 * being served on - the mechanism that lets one deployment serve many
 * brands' domains - falling back to VITE_BRAND_ID (a fixed brand for local
 * dev/CI, where the hostname is just "localhost") when that hostname has no
 * brand configured. Whatever this resolves to also becomes the brandId
 * register() sends - see useBrandTheme, which is what actually calls this
 * and stores the result in useBrandStore.
 */
export async function getPublicBrand(): Promise<PublicBrand | undefined> {
  const byDomainResponse = await fetch(
    `${BASE_URL}/public/brands/by-domain/${encodeURIComponent(window.location.hostname)}`,
  );
  if (byDomainResponse.ok) {
    return (await byDomainResponse.json()) as PublicBrand;
  }

  if (!FALLBACK_BRAND_ID) return undefined;
  const byIdResponse = await fetch(`${BASE_URL}/public/brands/${FALLBACK_BRAND_ID}`);
  if (!byIdResponse.ok) return undefined;
  return (await byIdResponse.json()) as PublicBrand;
}

export interface CompetitionRanking {
  competition: string;
  rank: number;
}

/** Staff-configured "how important is this competition" order for the sport page's importance sort - see apps/backend's CompetitionRankingModule. */
export async function getCompetitionRankings(brandId: string): Promise<CompetitionRanking[]> {
  const response = await fetch(`${BASE_URL}/public/competition-rankings/${encodeURIComponent(brandId)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch competition rankings: ${response.status}`);
  }
  return (await response.json()) as CompetitionRanking[];
}

export interface CompetitionQuicklink {
  competition: string;
  order: number;
}

/** Staff-curated cross-sport shortcut list for the sidebar's "Top Competitions" section - see apps/backend's CompetitionQuicklinkModule. Separate from CompetitionRanking, which orders each sport's own drill-down independently. */
export async function getCompetitionQuicklinks(brandId: string): Promise<CompetitionQuicklink[]> {
  const response = await fetch(`${BASE_URL}/public/competition-quicklinks/${encodeURIComponent(brandId)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch competition quicklinks: ${response.status}`);
  }
  return (await response.json()) as CompetitionQuicklink[];
}

export interface PublicTeamColor {
  name: string;
  colorHex: string;
}

/** Backoffice-assigned real team colors - see apps/backend's TeamColorsModule. Only teams an admin has actually assigned a color to are returned. */
export async function getTeamColors(): Promise<PublicTeamColor[]> {
  const response = await fetch(`${BASE_URL}/public/team-colors`);
  if (!response.ok) {
    throw new Error(`Failed to fetch team colors: ${response.status}`);
  }
  return (await response.json()) as PublicTeamColor[];
}

export type DisplayNameEntityType =
  | 'SPORT'
  | 'COUNTRY'
  | 'COMPETITION'
  | 'TEAM'
  | 'MARKET'
  | 'SELECTION';

export interface PublicDisplayNameOverride {
  entityType: DisplayNameEntityType;
  rawName: string;
  displayName: string;
}

/** Backoffice-assigned nicer labels for raw feed names - see apps/backend's DisplayNamesModule. Only entities an admin has actually set an override for are returned. */
export async function getDisplayNameOverrides(): Promise<PublicDisplayNameOverride[]> {
  const response = await fetch(`${BASE_URL}/public/display-names`);
  if (!response.ok) {
    throw new Error(`Failed to fetch display name overrides: ${response.status}`);
  }
  return (await response.json()) as PublicDisplayNameOverride[];
}

/**
 * Matches/odds for the acting brand, margin-adjusted server-side (see
 * MarginPricingService) - this is why matches are fetched through the
 * backend rather than straight from odds-engine like apps/backoffice does.
 */
export async function getMatches(brandId: string): Promise<Match[]> {
  const response = await fetch(`${BASE_URL}/public/matches/${encodeURIComponent(brandId)}`, {
    headers: optionalAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch matches: ${response.status}`);
  }
  return (await response.json()) as Match[];
}

/** Matches with at least one manual (Specials) market for the acting brand - see apps/backend's PublicSpecialsController. */
export async function getSpecials(brandId: string): Promise<Match[]> {
  const response = await fetch(`${BASE_URL}/public/specials/${encodeURIComponent(brandId)}`, {
    headers: optionalAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch specials: ${response.status}`);
  }
  return (await response.json()) as Match[];
}

/** Every currently-boosted selection for the acting brand, flattened with match context - see apps/backend's PublicBoostsController. */
export async function getBoosts(brandId: string): Promise<BoostedSelectionSummary[]> {
  const response = await fetch(`${BASE_URL}/public/boosts/${encodeURIComponent(brandId)}`, {
    headers: optionalAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch boosts: ${response.status}`);
  }
  return (await response.json()) as BoostedSelectionSummary[];
}

export type BetAndGetTrigger = 'PLACEMENT' | 'SETTLEMENT';
export type BetAndGetBetType = 'SINGLES_ONLY' | 'ACCUMULATOR_ONLY' | 'EITHER';

export interface BetAndGetCampaign {
  id: string;
  name: string;
  description: string | null;
  rewardAmountCents: number;
  trigger: BetAndGetTrigger;
  triggerOnWon: boolean;
  triggerOnLost: boolean;
  triggerOnVoid: boolean;
  minStakeCents: number | null;
  minOddsPerLeg: number | null;
  betType: BetAndGetBetType;
  minSelections: number | null;
}

/** Every enabled Bet & Get campaign for the acting brand - see apps/backend's BetAndGetPublicController. */
export async function getBetAndGetCampaigns(brandId: string): Promise<BetAndGetCampaign[]> {
  const response = await fetch(`${BASE_URL}/public/bet-and-get-campaigns/${encodeURIComponent(brandId)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch Bet & Get campaigns: ${response.status}`);
  }
  return (await response.json()) as BetAndGetCampaign[];
}

/** Every match currently in scope for this campaign - drives the campaign-matches page's single-vs-many resolution. */
export async function getBetAndGetCampaignMatches(brandId: string, campaignId: string): Promise<Match[]> {
  const response = await fetch(
    `${BASE_URL}/public/bet-and-get-campaigns/${encodeURIComponent(brandId)}/${encodeURIComponent(campaignId)}/matches`,
    { headers: optionalAuthHeaders() },
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch campaign matches: ${response.status}`);
  }
  return (await response.json()) as Match[];
}

/** Every enabled campaign covering this one match - backs the match-detail context banner. */
export async function getBetAndGetCampaignsForMatch(brandId: string, matchId: string): Promise<BetAndGetCampaign[]> {
  const response = await fetch(
    `${BASE_URL}/public/bet-and-get-campaigns/${encodeURIComponent(brandId)}/match/${encodeURIComponent(matchId)}`,
    { headers: optionalAuthHeaders() },
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch campaigns for match: ${response.status}`);
  }
  return (await response.json()) as BetAndGetCampaign[];
}

export interface MarketSuspension {
  matchId: string;
  /** Empty string means the whole match is suspended, not just one market - see apps/backend's MarketSuspensionService. */
  marketId: string;
  /** Empty string means the whole market is suspended, not just one selection. */
  selectionId: string;
}

/** Currently-suspended matches/markets/selections for the acting brand - see apps/backend's MarketSuspensionModule. */
export async function getMarketSuspensions(brandId: string): Promise<MarketSuspension[]> {
  const response = await fetch(`${BASE_URL}/public/market-suspensions/${encodeURIComponent(brandId)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch market suspensions: ${response.status}`);
  }
  return (await response.json()) as MarketSuspension[];
}

/** Currently-suspended competitions for the acting brand (every match within blocked) - see apps/backend's CompetitionSuspensionService. */
export async function getCompetitionSuspensions(brandId: string): Promise<string[]> {
  const response = await fetch(
    `${BASE_URL}/public/competition-suspensions/${encodeURIComponent(brandId)}`,
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch competition suspensions: ${response.status}`);
  }
  return (await response.json()) as string[];
}

export interface AccaBoostConfig {
  boostPercentPerLeg: number;
  minSelections: number;
  minOddsPerLeg: number;
  enabled: boolean;
}

/** The acting brand's accumulator-boost settings - see apps/backend's AccaBoostService. */
export async function getAccaBoostConfig(brandId: string): Promise<AccaBoostConfig> {
  const response = await fetch(`${BASE_URL}/public/acca-boost-config/${encodeURIComponent(brandId)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch acca boost config: ${response.status}`);
  }
  return (await response.json()) as AccaBoostConfig;
}

export interface AccaRollbackConfig {
  minSelections: number;
  lossThreshold: number;
  rewardPercent: number;
  enabled: boolean;
}

/** The acting brand's accumulator-rollback settings - see apps/backend's AccaRollbackService. */
export async function getAccaRollbackConfig(brandId: string): Promise<AccaRollbackConfig> {
  const response = await fetch(`${BASE_URL}/public/acca-rollback-config/${encodeURIComponent(brandId)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch acca rollback config: ${response.status}`);
  }
  return (await response.json()) as AccaRollbackConfig;
}

export interface InsuranceBetConfig {
  costPercent: number;
  enabled: boolean;
}

/** The acting brand's insurance-bet settings - see apps/backend's InsuranceBetService. */
export async function getInsuranceBetConfig(brandId: string): Promise<InsuranceBetConfig> {
  const response = await fetch(`${BASE_URL}/public/insurance-bet-config/${encodeURIComponent(brandId)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch insurance bet config: ${response.status}`);
  }
  return (await response.json()) as InsuranceBetConfig;
}

export interface StakeLimitPreview {
  maxStakeCents: number | null;
  maxLiabilityCents: number | null;
  /** The smaller of maxStakeCents and maxLiabilityCents converted into stake terms via this bet's own combined odds - the one number to compare a typed stake against. Null means unlimited. */
  effectiveMaxStakeCents: number | null;
}

/**
 * A preview of what PamService.assertWithinStakeLimits would allow for
 * this exact set of selections, so the bet slip can warn before a player
 * tries to place a bet that would just get rejected. Soft-authenticated
 * (see optionalAuthHeaders) - a logged-out player still gets the
 * cascade-based preview, just without any PLAYER-scoped override.
 */
export async function previewStakeLimit(
  brandId: string,
  selections: PlaceBetSelection[],
): Promise<StakeLimitPreview> {
  const response = await fetch(`${BASE_URL}/public/stake-limit-preview/${encodeURIComponent(brandId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...optionalAuthHeaders() },
    body: JSON.stringify({ selections }),
  });
  if (!response.ok) {
    throw new Error(`Failed to preview stake limit: ${response.status}`);
  }
  return (await response.json()) as StakeLimitPreview;
}

export type BrandImageListKind = 'SPONSOR_LOGO' | 'PAYMENT_METHOD';

export interface BrandImageListItem {
  id: string;
  brandId: string;
  kind: BrandImageListKind;
  mimeType: string;
  sortOrder: number;
}

/** Staff-uploaded, ordered image list (sponsor logos, payment method icons) - see apps/backend's BrandImageListModule. Empty until an admin uploads something. */
export async function getBrandImageList(
  brandId: string,
  kind: BrandImageListKind,
): Promise<BrandImageListItem[]> {
  const response = await fetch(
    `${BASE_URL}/public/brand-image-list/${encodeURIComponent(brandId)}/${kind}`,
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch ${kind} images: ${response.status}`);
  }
  return (await response.json()) as BrandImageListItem[];
}

export async function getMatchById(brandId: string, matchId: string): Promise<Match | undefined> {
  const response = await fetch(
    `${BASE_URL}/public/matches/${encodeURIComponent(brandId)}/${encodeURIComponent(matchId)}`,
    { headers: optionalAuthHeaders() },
  );
  if (response.status === 404) {
    return undefined;
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch match ${matchId}: ${response.status}`);
  }
  return (await response.json()) as Match;
}

export async function register(payload: RegisterPayload): Promise<AuthTokenResponse> {
  const response = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ ...payload, brandId: useBrandStore.getState().brandId }),
  });
  return parseJsonOrThrow(response, `Registration failed: ${response.status}`);
}

export async function login(payload: LoginPayload): Promise<AuthTokenResponse> {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(response, `Login failed: ${response.status}`);
}

let inFlightRefresh: Promise<AuthTokenResponse | undefined> | null = null;

/**
 * Uses the httpOnly refresh cookie - returns undefined (rather than throwing)
 * when there's no valid session. Refresh tokens are single-use (rotated on
 * every call), so two concurrent callers racing this - e.g. React
 * StrictMode's double effect invocation in dev, or two API calls both
 * hitting a 401 around the same moment in production - must share one
 * in-flight request rather than each firing their own: the second of two
 * real concurrent requests would otherwise find the token already revoked
 * by the first and spuriously fail.
 */
export function refreshAccessToken(): Promise<AuthTokenResponse | undefined> {
  if (inFlightRefresh) {
    return inFlightRefresh;
  }

  inFlightRefresh = (async () => {
    try {
      const response = await fetch(`${BASE_URL}/auth/refresh`, {
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

export async function logout(): Promise<void> {
  await fetch(`${BASE_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
}

/** Attaches the current access token, and transparently refreshes-and-retries once on a 401. */
async function authenticatedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const requestWithToken = (token: string | null) =>
    fetch(`${BASE_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: { ...init.headers, Authorization: token ? `Bearer ${token}` : '' },
    });

  const response = await requestWithToken(useAuthStore.getState().accessToken);
  if (response.status !== 401) {
    return response;
  }

  const refreshed = await refreshAccessToken();
  if (!refreshed) {
    useAuthStore.getState().clearAuth();
    return response;
  }

  useAuthStore.getState().setAuth(refreshed.accessToken);
  return requestWithToken(refreshed.accessToken);
}

export async function getWallet(): Promise<Wallet> {
  const response = await authenticatedFetch('/wallet');
  return parseJsonOrThrow(response, `Failed to load wallet: ${response.status}`);
}

export async function placeBet(payload: PlaceBetPayload): Promise<PlacedBet> {
  const response = await authenticatedFetch('/bets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(response, `Failed to place bet: ${response.status}`);
}

export async function getBets(): Promise<PlacedBet[]> {
  const response = await authenticatedFetch('/bets');
  return parseJsonOrThrow(response, `Failed to load bets: ${response.status}`);
}

export async function getFreebets(): Promise<Freebet[]> {
  const response = await authenticatedFetch('/freebets');
  return parseJsonOrThrow(response, `Failed to load freebets: ${response.status}`);
}
