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

/** Common ISO 4217 codes offered in the brand currency picker - any valid 3-letter code is accepted by the backend, this is just a curated shortlist. */
export const CURRENCY_CODES = ['EUR', 'USD', 'GBP', 'BRL', 'MXN', 'CAD', 'AUD', 'CHF'] as const;

export const BRAND_LOGO_SLOTS = ['SITE_LIGHT', 'SITE_DARK', 'SHARE_LIGHT', 'SHARE_DARK'] as const;
export type BrandLogoSlot = (typeof BRAND_LOGO_SLOTS)[number];

export const GRADIENT_DIRECTIONS = ['to-t', 'to-b', 'to-l', 'to-r', 'to-tl', 'to-tr', 'to-bl', 'to-br'] as const;
export type GradientDirection = (typeof GRADIENT_DIRECTIONS)[number];

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

/** A brand-configurable color zone - always both a light and a dark value, so switching theme never loses the other's setting. */
export interface ColorZone {
  light: ColorValue;
  dark: ColorValue;
}

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
  logoLightUrl: string | null;
  logoDarkUrl: string | null;
  shareLogoLightUrl: string | null;
  shareLogoDarkUrl: string | null;
  themeMode: ThemeMode;
  currencyCode: string;
  backgroundColor: ColorZone | null;
  surfaceColor: ColorZone | null;
  buttonColor: ColorZone | null;
  highlightColor: ColorZone | null;
  filterColor: ColorZone | null;
  textColor: ColorZone | null;
  freebetBadgeColor: ColorZone | null;
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
  logoLightUrl?: string;
  logoDarkUrl?: string;
  shareLogoLightUrl?: string;
  shareLogoDarkUrl?: string;
  themeMode?: ThemeMode;
  currencyCode?: string;
  backgroundColor?: ColorZone;
  surfaceColor?: ColorZone;
  buttonColor?: ColorZone;
  highlightColor?: ColorZone;
  filterColor?: ColorZone;
  textColor?: ColorZone;
  freebetBadgeColor?: ColorZone;
}

export interface UpdateBrandPayload {
  name?: string;
  domain?: string;
  logoLightUrl?: string;
  logoDarkUrl?: string;
  shareLogoLightUrl?: string;
  shareLogoDarkUrl?: string;
  themeMode?: ThemeMode;
  currencyCode?: string;
  backgroundColor?: ColorZone;
  surfaceColor?: ColorZone;
  buttonColor?: ColorZone;
  highlightColor?: ColorZone;
  filterColor?: ColorZone;
  textColor?: ColorZone;
  freebetBadgeColor?: ColorZone;
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

/** Replaces whatever was previously uploaded to this slot only - the other 3 slots are untouched. No Content-Type header set - fetch derives the multipart boundary itself from the FormData body. */
export async function uploadBrandLogo(brandId: string, slot: BrandLogoSlot, file: File): Promise<Brand> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await authenticatedFetch(`/master/brands/${brandId}/logo/${slot}`, {
    method: 'POST',
    body: formData,
  });
  return parseJsonOrThrow(response, `Failed to upload logo: ${response.status}`);
}

export async function removeBrandLogo(brandId: string, slot: BrandLogoSlot): Promise<Brand> {
  const response = await authenticatedFetch(`/master/brands/${brandId}/logo/${slot}`, { method: 'DELETE' });
  return parseJsonOrThrow(response, `Failed to remove logo: ${response.status}`);
}
