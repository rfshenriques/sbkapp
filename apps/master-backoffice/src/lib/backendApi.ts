import { useMasterAuthStore } from '../features/auth/masterAuthStore';

const BASE_URL = '/backend';

export interface AuthTokenResponse {
  accessToken: string;
}

export interface MasterLoginPayload {
  identifier: string;
  password: string;
}

export const KNOWN_PRODUCTS = ['CASHOUT', 'BET_BUILDER'] as const;
export type KnownProduct = (typeof KNOWN_PRODUCTS)[number];

export const THEME_MODES = ['LIGHT', 'DARK'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export interface BrandProductFlag {
  id: string;
  brandId: string;
  product: string;
  enabled: boolean;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  logoUrl: string | null;
  themeMode: ThemeMode;
  buttonColorHex: string | null;
  highlightColorHex: string | null;
  filterColorHex: string | null;
  /** Whether a winning freebet-funded bet credits its stake back alongside net winnings - always to the player's cash balance, never back into freebets. */
  freebetStakeReturnedOnWin: boolean;
  createdAt: string;
  updatedAt: string;
  productFlags: BrandProductFlag[];
}

export interface CreateBrandPayload {
  name: string;
  slug: string;
  domain?: string;
  logoUrl?: string;
  themeMode?: ThemeMode;
  buttonColorHex?: string;
  highlightColorHex?: string;
  filterColorHex?: string;
}

export interface UpdateBrandPayload {
  name?: string;
  domain?: string;
  logoUrl?: string;
  themeMode?: ThemeMode;
  buttonColorHex?: string;
  highlightColorHex?: string;
  filterColorHex?: string;
  freebetStakeReturnedOnWin?: boolean;
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

export async function masterLogin(payload: MasterLoginPayload): Promise<AuthTokenResponse> {
  const response = await fetch(`${BASE_URL}/master/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(response, `Login failed: ${response.status}`);
}

let inFlightRefresh: Promise<AuthTokenResponse | undefined> | null = null;

/**
 * Uses the httpOnly master refresh cookie - returns undefined (rather than
 * throwing) when there's no valid session. Deduplicated the same way as
 * apps/backoffice/src/lib/backendApi.ts: refresh tokens are single-use, so
 * two concurrent callers - e.g. React StrictMode's double effect
 * invocation in dev - must share one in-flight request rather than each
 * firing their own and racing each other's rotation.
 */
export function refreshMasterAccessToken(): Promise<AuthTokenResponse | undefined> {
  if (inFlightRefresh) {
    return inFlightRefresh;
  }

  inFlightRefresh = (async () => {
    try {
      const response = await fetch(`${BASE_URL}/master/auth/refresh`, {
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

export async function masterLogout(): Promise<void> {
  await fetch(`${BASE_URL}/master/auth/logout`, { method: 'POST', credentials: 'include' });
}

/** Attaches the current master access token, and transparently refreshes-and-retries once on a 401. */
async function authenticatedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const requestWithToken = (token: string | null) =>
    fetch(`${BASE_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: { ...init.headers, Authorization: token ? `Bearer ${token}` : '' },
    });

  const response = await requestWithToken(useMasterAuthStore.getState().accessToken);
  if (response.status !== 401) {
    return response;
  }

  const refreshed = await refreshMasterAccessToken();
  if (!refreshed) {
    useMasterAuthStore.getState().clearAuth();
    return response;
  }

  useMasterAuthStore.getState().setAuth(refreshed.accessToken);
  return requestWithToken(refreshed.accessToken);
}

export async function listBrands(): Promise<Brand[]> {
  const response = await authenticatedFetch('/master/brands');
  return parseJsonOrThrow(response, `Failed to load brands: ${response.status}`);
}

export async function getBrand(id: string): Promise<Brand> {
  const response = await authenticatedFetch(`/master/brands/${id}`);
  return parseJsonOrThrow(response, `Failed to load brand: ${response.status}`);
}

export async function createBrand(payload: CreateBrandPayload): Promise<Brand> {
  const response = await authenticatedFetch('/master/brands', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(response, `Failed to create brand: ${response.status}`);
}

export async function updateBrand(id: string, payload: UpdateBrandPayload): Promise<Brand> {
  const response = await authenticatedFetch(`/master/brands/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(response, `Failed to update brand: ${response.status}`);
}

export async function setProductFlag(
  brandId: string,
  product: string,
  enabled: boolean,
): Promise<Brand> {
  const response = await authenticatedFetch(
    `/master/brands/${brandId}/products/${encodeURIComponent(product)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    },
  );
  return parseJsonOrThrow(response, `Failed to update product flag: ${response.status}`);
}
