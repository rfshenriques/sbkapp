import type { BoostedSelectionSummary, Match, TopNavIconKey } from '@sportsbook/shared';
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/browser';
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

export interface BetSlipSettings {
  autoUpdateOdds: boolean;
  quickStakeCents: number[];
}

export interface UpdateBetSlipSettingsPayload {
  autoUpdateOdds?: boolean;
  quickStakeCents?: number[];
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
  /** Draws stakeCents from the player's pooled freebets balance instead of cash - any typed amount up to that balance, not a fixed token value (see FreebetService.spendFromBalance). */
  useFreebets?: boolean;
  /** Opts into insurance (see InsuranceBetService) - reduces the payout by the brand's cost percent, refunds the stake as a freebet if the bet loses. Never applies alongside useFreebets. */
  insuranceOptIn?: boolean;
}

export type FreebetSource = 'MANUAL' | 'ACCA_ROLLBACK' | 'INSURANCE_BET' | 'BET_AND_GET' | 'DEPOSIT_CAMPAIGN';

/** One grant toward a player's pooled freebets balance - always ACTIVE, unexpired, and not yet fully drawn down (see PamService.getFreebets/FreebetService.listActive). remainingCents (not amountCents) is what's actually still spendable. */
export interface Freebet {
  id: string;
  amountCents: number;
  remainingCents: number;
  expiresAt: string | null;
  createdAt: string;
  source: FreebetSource;
  sourceCampaignId: string | null;
  /** Resolved name of the BET_AND_GET/DEPOSIT_CAMPAIGN campaign that granted this, null for other sources or if the campaign is no longer found. */
  campaignName: string | null;
}

export type BetStatus = 'PENDING' | 'WON' | 'LOST' | 'VOID' | 'CASHED_OUT';
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
  /** Drew its stake from the pooled freebets balance instead of cash - see FreebetService.spendFromBalance. */
  fundedByFreebets: boolean;
  /** Insurance premium % actually deducted at placement - 0 when not insured. combinedOdds/potentialPayoutCents already reflect it; the pre-insurance values are derivable by dividing back out. */
  insuranceCostPercent: number;
  /** Acca boost % actually applied at placement - 0 when not boosted. combinedOdds already reflects it. */
  accaBoostPercent: number;
  /** Name of the Bet & Get campaign this bet qualified for, if any - resolved once at placement, frozen even if the campaign later changes. */
  betAndGetCampaignName: string | null;
  /** The Bet & Get campaign's fixed freebet reward, in cents - null exactly when betAndGetCampaignName is null. */
  betAndGetCampaignRewardCents: number | null;
  /** Name of the deposit campaign this bet fulfilled the bet-requirement for, if any. */
  depositCampaignName: string | null;
  /** The deposit campaign redemption's own freebet reward, in cents (fixed or percentage-derived - see computeDepositReward) - null exactly when depositCampaignName is null. */
  depositCampaignRewardCents: number | null;
  /** Name of the register (welcome) campaign this bet fulfilled the bet-requirement for, if any. */
  registerCampaignName: string | null;
  /** The register campaign redemption's own freebet reward, in cents - null exactly when registerCampaignName is null. */
  registerCampaignRewardCents: number | null;
  /** How much was refunded as a freebet via the acca rollback promotion, if this bet triggered one - derived, not a property of the bet itself (see PamService.enrichBetsWithRollbackReward). */
  accaRollbackRewardCents: number | null;
  /** Set only when status is CASHED_OUT - what was actually credited to the balance at cashout time. */
  cashedOutValueCents: number | null;
  cashedOutAt: string | null;
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

export type GradientDirection = 'to-t' | 'to-b' | 'to-l' | 'to-r' | 'to-tl' | 'to-tr' | 'to-bl' | 'to-br';

export interface SolidColor {
  type: 'solid';
  hex: string;
}

export interface GradientColor {
  type: 'gradient';
  direction: GradientDirection;
  fromHex: string;
  toHex: string;
}

export type ColorValue = SolidColor | GradientColor;

/** A brand-configurable color zone - always both a light and a dark value, see useBrandTheme. */
export interface ColorZone {
  light: ColorValue;
  dark: ColorValue;
}

export interface PublicBrand {
  id: string;
  name: string;
  logoLightUrl: string | null;
  logoDarkUrl: string | null;
  shareLogoLightUrl: string | null;
  shareLogoDarkUrl: string | null;
  appIconUrl: string | null;
  themeMode: 'LIGHT' | 'DARK';
  currencyCode: string;
  timeFormat: 'H12' | 'H24';
  backgroundColor: ColorZone | null;
  surfaceColor: ColorZone | null;
  buttonColor: ColorZone | null;
  highlightColor: ColorZone | null;
  filterColor: ColorZone | null;
  textColor: ColorZone | null;
  freebetBadgeColor: ColorZone | null;
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
/**
 * Returns null (never undefined) when no brand resolves - react-query
 * treats a queryFn resolving to undefined as invalid ("Query data cannot
 * be undefined") and the query never settles out of isPending, which
 * AppShell's boot screen depends on to ever stop showing (see
 * AppBootScreen.tsx).
 */
export async function getPublicBrand(): Promise<PublicBrand | null> {
  const byDomainResponse = await fetch(
    `${BASE_URL}/public/brands/by-domain/${encodeURIComponent(window.location.hostname)}`,
  );
  if (byDomainResponse.ok) {
    return (await byDomainResponse.json()) as PublicBrand;
  }

  if (!FALLBACK_BRAND_ID) return null;
  const byIdResponse = await fetch(`${BASE_URL}/public/brands/${FALLBACK_BRAND_ID}`);
  if (!byIdResponse.ok) return null;
  return (await byIdResponse.json()) as PublicBrand;
}

export interface HomepageCarouselConfig {
  enabled: boolean;
  autoScrollSeconds: number;
}

/** Whether/how fast to auto-advance the homepage's "Match of the day + Challenges" row - see apps/backend's HomepageCarouselModule. */
export async function getHomepageCarouselConfig(brandId: string): Promise<HomepageCarouselConfig> {
  const response = await fetch(`${BASE_URL}/public/homepage-carousel-config/${encodeURIComponent(brandId)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch homepage carousel config: ${response.status}`);
  }
  return (await response.json()) as HomepageCarouselConfig;
}

/** A staff-picked "Match of the day" entry, already filtered server-side to only the ones currently within their (optional) scheduling window - see apps/backend's MatchOfTheDayModule. `matchId` is resolved against the live match list client-side (see OddsBoardPage); an entry whose match has since kicked off/expired from the feed just silently drops. */
export interface MatchOfTheDayEntry {
  id: string;
  matchId: string;
  sortOrder: number;
}

/** Never auto-picked - an empty array means the brand hasn't configured one, and apps/frontend shows no featured match at all rather than fabricating one. */
export async function getMatchOfTheDay(brandId: string): Promise<MatchOfTheDayEntry[]> {
  const response = await fetch(`${BASE_URL}/public/match-of-the-day/${encodeURIComponent(brandId)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch Match of the day entries: ${response.status}`);
  }
  return (await response.json()) as MatchOfTheDayEntry[];
}

export type TopNavItemKind =
  | 'SPORT'
  | 'COMPETITION'
  | 'MATCH'
  | 'TODAY'
  | 'TOMORROW'
  | 'BOOSTS'
  | 'SPECIALS'
  | 'CHALLENGE'
  | 'LEADERBOARD';

/** A staff-configured entry in the second navbar (see apps/backend's TopNavModule) - exactly one target field is set, matching `kind` (TODAY/TOMORROW/BOOSTS/SPECIALS carry none - fixed destinations). */
export interface TopNavItem {
  id: string;
  kind: TopNavItemKind;
  label: string;
  icon: TopNavIconKey;
  sport: string | null;
  competition: string | null;
  matchId: string | null;
  betAndGetCampaignId: string | null;
  leaderboardCampaignId: string | null;
  sortOrder: number;
}

export async function getTopNavItems(brandId: string): Promise<TopNavItem[]> {
  const response = await fetch(`${BASE_URL}/public/top-nav/${encodeURIComponent(brandId)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch top nav items: ${response.status}`);
  }
  return (await response.json()) as TopNavItem[];
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
  colorHex: string | null;
  acronym: string | null;
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
export type BetAndGetTiming = 'PREMATCH_ONLY' | 'INPLAY_ONLY' | 'EITHER';
export type BetAndGetRewardType = 'FIXED' | 'PERCENTAGE';

export interface BetAndGetCampaign {
  id: string;
  name: string;
  description: string | null;
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
  bettingTiming: BetAndGetTiming;
}

/** A campaign as returned for a specific match - adds whether it's in scope but blocked by the timing requirement. */
export interface BetAndGetCampaignForMatch extends BetAndGetCampaign {
  timingBlocked: boolean;
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
export async function getBetAndGetCampaignsForMatch(
  brandId: string,
  matchId: string,
): Promise<BetAndGetCampaignForMatch[]> {
  const response = await fetch(
    `${BASE_URL}/public/bet-and-get-campaigns/${encodeURIComponent(brandId)}/match/${encodeURIComponent(matchId)}`,
    { headers: optionalAuthHeaders() },
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch campaigns for match: ${response.status}`);
  }
  return (await response.json()) as BetAndGetCampaignForMatch[];
}

export type DepositRewardType = 'FIXED' | 'PERCENTAGE';

export interface DepositCampaign {
  id: string;
  name: string;
  description: string | null;
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
  /** Optional scheduling window (see Brand admin) - only present when the campaign was given an end time; drives the modal's countdown. */
  endAt?: string | null;
}

/** A single deposit campaign by id - backs a deposit-linked promo card's click-through. See apps/backend's PublicDepositCampaignController. */
export async function getDepositCampaign(brandId: string, id: string): Promise<DepositCampaign> {
  const response = await fetch(
    `${BASE_URL}/public/deposit-campaigns/${encodeURIComponent(brandId)}/${encodeURIComponent(id)}`,
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch deposit campaign: ${response.status}`);
  }
  return (await response.json()) as DepositCampaign;
}

/** The first enabled deposit campaign this logged-in player is targeted by and can still redeem, or null - drives the post-login modal. */
export async function getEligibleDepositCampaign(): Promise<DepositCampaign | null> {
  const response = await authenticatedFetch('/deposit-campaigns/eligible');
  return parseJsonOrThrow(response, `Failed to check deposit campaign eligibility: ${response.status}`);
}

export interface DepositCampaignRedemption {
  id: string;
  rewardAmountCents: number;
  status: 'PENDING_BET' | 'PENDING_SETTLEMENT' | 'GRANTED';
}

export interface DepositResult {
  deposit: { id: string; amountCents: number };
  redemption: DepositCampaignRedemption | null;
}

/** Paper-money top-up (see apps/backend's DepositService) - also resolves and applies any eligible deposit campaign in the same transaction. */
export async function recordDeposit(amountCents: number): Promise<DepositResult> {
  const response = await authenticatedFetch('/deposits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amountCents }),
  });
  return parseJsonOrThrow(response, `Failed to record deposit: ${response.status}`);
}

export interface LeaderboardRewardTier {
  id: string;
  rankFrom: number;
  rankTo: number;
  rewardAmountCents: number;
}

export interface LeaderboardCampaign {
  id: string;
  name: string;
  description: string | null;
  startAt: string | null;
  /** Required - a leaderboard always has a definite end (see LeaderboardCampaignService). */
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
  rewardTiers: LeaderboardRewardTier[];
  /** Set once end-of-campaign prizes have been granted - null until then. */
  prizesGrantedAt: string | null;
}

/** A campaign as returned for a specific match - adds whether it's in scope but blocked by the timing requirement, same shape as BetAndGetCampaignForMatch. */
export interface LeaderboardCampaignForMatch extends LeaderboardCampaign {
  timingBlocked: boolean;
}

/** One ranked row - see apps/backend's LeaderboardPublicController.getEntries. Every username but the viewer's own is masked server-side (maskUsername); username is set ONLY on the viewer's own row. */
export interface LeaderboardEntryView {
  entryId: string;
  rank: number;
  pointsTotal: number;
  maskedUsername: string;
  username: string | null;
  isViewer: boolean;
}

/** A player's own opt-in row - see apps/backend's LeaderboardController. */
export interface LeaderboardEntry {
  id: string;
  pointsTotal: number;
  joinedAt: string;
}

/** Every enabled leaderboard campaign for the acting brand. */
export async function getLeaderboardCampaigns(brandId: string): Promise<LeaderboardCampaign[]> {
  const response = await fetch(`${BASE_URL}/public/leaderboard-campaigns/${encodeURIComponent(brandId)}`, {
    headers: optionalAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch leaderboard campaigns: ${response.status}`);
  }
  return (await response.json()) as LeaderboardCampaign[];
}

export async function getLeaderboardCampaign(brandId: string, id: string): Promise<LeaderboardCampaign> {
  const response = await fetch(
    `${BASE_URL}/public/leaderboard-campaigns/${encodeURIComponent(brandId)}/${encodeURIComponent(id)}`,
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch leaderboard campaign: ${response.status}`);
  }
  return (await response.json()) as LeaderboardCampaign;
}

/** Ranked entries, masked per apps/backend's LeaderboardPublicController.getEntries - attaches the viewer's token (when logged in) so their own row comes back unmasked. */
export async function getLeaderboardCampaignEntries(brandId: string, id: string): Promise<LeaderboardEntryView[]> {
  const response = await fetch(
    `${BASE_URL}/public/leaderboard-campaigns/${encodeURIComponent(brandId)}/${encodeURIComponent(id)}/entries`,
    { headers: optionalAuthHeaders() },
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch leaderboard entries: ${response.status}`);
  }
  return (await response.json()) as LeaderboardEntryView[];
}

/** Every enabled leaderboard covering this one match - backs the match-detail context banner. */
export async function getLeaderboardCampaignsForMatch(
  brandId: string,
  matchId: string,
): Promise<LeaderboardCampaignForMatch[]> {
  const response = await fetch(
    `${BASE_URL}/public/leaderboard-campaigns/${encodeURIComponent(brandId)}/match/${encodeURIComponent(matchId)}`,
    { headers: optionalAuthHeaders() },
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch leaderboards for match: ${response.status}`);
  }
  return (await response.json()) as LeaderboardCampaignForMatch[];
}

/** Opts the logged-in player into a leaderboard's ranking - idempotent, returns the existing entry if already joined. */
export async function joinLeaderboardCampaign(id: string): Promise<LeaderboardEntry> {
  const response = await authenticatedFetch(`/leaderboard-campaigns/${encodeURIComponent(id)}/join`, {
    method: 'POST',
  });
  return parseJsonOrThrow(response, `Failed to join leaderboard: ${response.status}`);
}

/** The logged-in player's own entry for this leaderboard, or null if they haven't joined. */
export async function getMyLeaderboardEntry(id: string): Promise<LeaderboardEntry | null> {
  const response = await authenticatedFetch(`/leaderboard-campaigns/${encodeURIComponent(id)}/my-entry`);
  return parseJsonOrThrow(response, `Failed to load your leaderboard entry: ${response.status}`);
}

export type PromoCardStatus = 'ACTIVE' | 'EARLY_ENDED';

export interface PromoCardItem {
  id: string;
  mimeType: string | null;
  title: string | null;
  subtitle: string | null;
  sortOrder: number;
  betAndGetCampaignId: string | null;
  depositCampaignId: string | null;
  registerCampaignId: string | null;
  leaderboardCampaignId: string | null;
  /** False for a card auto-created for a campaign with no staff-uploaded image yet - see PromoCardTile. */
  hasImage: boolean;
  /** Live-computed from the linked campaign, never persisted - DISABLED campaigns are already dropped server-side, so this is only ever ACTIVE or EARLY_ENDED. */
  status: PromoCardStatus;
}

/** CMS-managed promo cards for the homepage/Challenges page - see apps/backend's PublicPromoCardController. */
export async function getPromoCards(brandId: string): Promise<PromoCardItem[]> {
  const response = await fetch(`${BASE_URL}/public/promo-cards/${encodeURIComponent(brandId)}`, {
    headers: optionalAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch promo cards: ${response.status}`);
  }
  return (await response.json()) as PromoCardItem[];
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
  minOdds: number;
}

/** The acting brand's insurance-bet settings - see apps/backend's InsuranceBetService. */
export async function getInsuranceBetConfig(brandId: string): Promise<InsuranceBetConfig> {
  const response = await fetch(`${BASE_URL}/public/insurance-bet-config/${encodeURIComponent(brandId)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch insurance bet config: ${response.status}`);
  }
  return (await response.json()) as InsuranceBetConfig;
}

export interface CashoutConfig {
  enabled: boolean;
  marginPercent: number;
}

/** The acting brand's cashout settings - see apps/backend's CashoutService. */
export async function getCashoutConfig(brandId: string): Promise<CashoutConfig> {
  const response = await fetch(`${BASE_URL}/public/cashout-config/${encodeURIComponent(brandId)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch cashout config: ${response.status}`);
  }
  return (await response.json()) as CashoutConfig;
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

export interface CampaignPreview {
  /** Name of the Bet & Get campaign this exact bet would link to at placement, if any - null when none applies (or the player has already exhausted their redemptions - see PamService.previewCampaign). */
  betAndGetCampaignName: string | null;
  betAndGetCampaignRewardCents: number | null;
  /** Name of the deposit campaign redemption this exact bet would fulfil, if any - always null for a logged-out preview, since a redemption is tied to a specific already-logged-in player. */
  depositCampaignName: string | null;
  depositCampaignRewardCents: number | null;
  /** Name of the register (welcome) campaign redemption this exact bet would fulfil, if any - always null for a logged-out preview, same reasoning as depositCampaignName (a redemption row only ever exists from registration onward). */
  registerCampaignName: string | null;
  registerCampaignRewardCents: number | null;
}

/**
 * A preview of which campaign(s) PamService.placeBet would link this exact
 * bet (selections + stake) to, so the bet slip can show "you'll qualify for
 * X" before the player places it - see PamService.previewCampaign, which
 * this mirrors. Soft-authenticated like previewStakeLimit; a logged-out
 * preview still resolves a Bet & Get campaign match (scope/conditions don't
 * need a player) but never a deposit campaign one.
 */
export async function previewCampaign(
  brandId: string,
  selections: PlaceBetSelection[],
  stakeCents: number,
  insuranceOptIn?: boolean,
  useFreebets?: boolean,
): Promise<CampaignPreview> {
  const response = await fetch(`${BASE_URL}/public/campaign-preview/${encodeURIComponent(brandId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...optionalAuthHeaders() },
    body: JSON.stringify({ selections, stakeCents, insuranceOptIn, useFreebets }),
  });
  if (!response.ok) {
    throw new Error(`Failed to preview campaign: ${response.status}`);
  }
  return (await response.json()) as CampaignPreview;
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

/**
 * Same endpoint as logout(), fired via sendBeacon instead of fetch - for the
 * tab-close/navigate-away moment (pagehide), where a normal fetch can be
 * cancelled mid-flight before it reaches the network. The endpoint only
 * consults the httpOnly refresh-token cookie (sent automatically, same
 * origin) and needs no body/headers, which is all sendBeacon can send
 * anyway. Fires and forgets - there's no response to react to once the tab
 * is gone. Returns false (nothing to catch/await) if the browser can't
 * queue the beacon at all, e.g. the payload exceeded its quota.
 */
export function logoutBeacon(): boolean {
  return navigator.sendBeacon(`${BASE_URL}/auth/logout`);
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

/** Server-stored bet slip preferences (see useBetSlipSettings) - logged-in players only. */
export async function getBetSlipSettings(): Promise<BetSlipSettings> {
  const response = await authenticatedFetch('/bet-slip-settings');
  return parseJsonOrThrow(response, `Failed to load bet slip settings: ${response.status}`);
}

export async function updateBetSlipSettings(payload: UpdateBetSlipSettingsPayload): Promise<BetSlipSettings> {
  const response = await authenticatedFetch('/bet-slip-settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(response, `Failed to update bet slip settings: ${response.status}`);
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

export type CashoutQuote =
  | { available: false; reason: string }
  | { available: true; stakeCents: number; cashoutValueCents: number };

/** A live re-quote of what cashing out this exact bet would credit right now - see apps/backend's PamService.getCashoutQuote. */
export async function getCashoutQuote(betId: string): Promise<CashoutQuote> {
  const response = await authenticatedFetch(`/bets/${encodeURIComponent(betId)}/cashout-quote`);
  return parseJsonOrThrow(response, `Failed to load cashout quote: ${response.status}`);
}

/** Cashes out an open bet early - credits the live quote to the balance and marks the bet CASHED_OUT. */
export async function cashOut(betId: string): Promise<PlacedBet> {
  const response = await authenticatedFetch(`/bets/${encodeURIComponent(betId)}/cashout`, { method: 'POST' });
  return parseJsonOrThrow(response, `Failed to cash out: ${response.status}`);
}

export async function getFreebets(): Promise<Freebet[]> {
  const response = await authenticatedFetch('/freebets');
  return parseJsonOrThrow(response, `Failed to load freebets: ${response.status}`);
}

export interface UnseenCelebrations {
  wonBets: PlacedBet[];
  freebetGrants: Freebet[];
}

/** WON bets and freebet grants the player hasn't yet had a celebration modal shown for - queried once after login so an event that happened while logged out still surfaces, unlike useBets()/useFreebets()'s own live polling. */
export async function getUnseenCelebrations(): Promise<UnseenCelebrations> {
  const response = await authenticatedFetch('/unseen-celebrations');
  return parseJsonOrThrow(response, `Failed to load unseen celebrations: ${response.status}`);
}

/** Marks the given bets/grants as having shown their celebration modal, so they never resurface on a later login. */
export async function acknowledgeCelebrations(betIds: string[], freebetGrantIds: string[]): Promise<void> {
  await authenticatedFetch('/unseen-celebrations/ack', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ betIds, freebetGrantIds }),
  });
}

export interface WebAuthnCredentialSummary {
  id: string;
  nickname: string | null;
  deviceType: string;
  createdAt: string;
  lastUsedAt: string | null;
}

/** See WebAuthnService.generateRegistrationOptionsForUser - fed straight into @simplewebauthn/browser's startRegistration(). */
export async function getWebAuthnRegistrationOptions(): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const response = await authenticatedFetch('/auth/webauthn/register/options', { method: 'POST' });
  return parseJsonOrThrow(response, `Failed to start passkey registration: ${response.status}`);
}

export async function verifyWebAuthnRegistration(
  response: RegistrationResponseJSON,
  nickname?: string,
): Promise<WebAuthnCredentialSummary> {
  const query = nickname ? `?nickname=${encodeURIComponent(nickname)}` : '';
  const res = await authenticatedFetch(`/auth/webauthn/register/verify${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(response),
  });
  return parseJsonOrThrow(res, `Failed to save passkey: ${res.status}`);
}

/** Public/unauthenticated - identity isn't known until the assertion comes back (discoverable-credential login). */
export async function getWebAuthnLoginOptions(): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const response = await fetch(`${BASE_URL}/auth/webauthn/login/options`, { method: 'POST' });
  return parseJsonOrThrow(response, `Failed to start passkey login: ${response.status}`);
}

export async function verifyWebAuthnLogin(response: AuthenticationResponseJSON): Promise<AuthTokenResponse> {
  const res = await fetch(`${BASE_URL}/auth/webauthn/login/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(response),
  });
  return parseJsonOrThrow(res, `Passkey login failed: ${res.status}`);
}

export async function listWebAuthnCredentials(): Promise<WebAuthnCredentialSummary[]> {
  const response = await authenticatedFetch('/auth/webauthn/credentials');
  return parseJsonOrThrow(response, `Failed to load passkeys: ${response.status}`);
}

export async function removeWebAuthnCredential(id: string): Promise<void> {
  await authenticatedFetch(`/auth/webauthn/credentials/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** Deployment-wide, unauthenticated - not per-brand, since one VAPID keypair covers every brand this backend serves (see PublicPushController). */
export async function getPushVapidPublicKey(): Promise<string> {
  const response = await fetch(`${BASE_URL}/public/push/vapid-public-key`);
  const result = await parseJsonOrThrow<{ publicKey: string }>(response, `Failed to fetch VAPID key: ${response.status}`);
  return result.publicKey;
}

export interface SubscribePushPayload {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
}

export async function subscribePush(payload: SubscribePushPayload): Promise<void> {
  const response = await authenticatedFetch('/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  await parseJsonOrThrow(response, `Failed to subscribe to push: ${response.status}`);
}

export async function unsubscribePush(endpoint: string): Promise<void> {
  await authenticatedFetch('/push/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  });
}
