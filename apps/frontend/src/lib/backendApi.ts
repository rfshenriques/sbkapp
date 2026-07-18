import { useAuthStore } from '../features/auth/authStore';

const BASE_URL = '/backend';

export interface AuthTokenResponse {
  accessToken: string;
}

export interface RegisterPayload {
  email: string;
  username: string;
  phone: string;
  password: string;
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
}

export interface PlacedBet {
  id: string;
  stakeCents: number;
  combinedOdds: string;
  potentialPayoutCents: number;
  status: string;
  createdAt: string;
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
 * Every player belongs to exactly one brand (see PROJECT_BRIEF.md Section
 * 10's brandId retrofit). There's no domain-based tenant resolution yet,
 * so this app - like every other deployment of it - is configured with
 * which brand it's registering players into via this env var, rather
 * than the registration form asking the player to pick one.
 */
const BRAND_ID = import.meta.env.VITE_BRAND_ID as string | undefined;

export interface PublicBrand {
  id: string;
  name: string;
  logoUrl: string | null;
  themeMode: 'LIGHT' | 'DARK';
  buttonColorHex: string | null;
  highlightColorHex: string | null;
}

export async function getPublicBrand(): Promise<PublicBrand | undefined> {
  if (!BRAND_ID) return undefined;
  const response = await fetch(`${BASE_URL}/public/brands/${BRAND_ID}`);
  if (!response.ok) return undefined;
  return (await response.json()) as PublicBrand;
}

export async function register(payload: RegisterPayload): Promise<AuthTokenResponse> {
  const response = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ ...payload, brandId: BRAND_ID }),
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
