import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../features/auth/authStore';
import { getCompetitionRankings, getPromoCards, getPublicBrand, type PublicBrand } from './backendApi';

const publicBrand: PublicBrand = {
  id: 'brand-1',
  name: 'BETPOR',
  logoLightUrl: null,
  logoDarkUrl: null,
  shareLogoLightUrl: null,
  shareLogoDarkUrl: null,
  themeMode: 'DARK',
  currencyCode: 'EUR',
  timeFormat: 'H24',
  backgroundColor: null,
  surfaceColor: null,
  buttonColor: { light: { type: 'solid', hex: '#E02127' }, dark: { type: 'solid', hex: '#E02127' } },
  highlightColor: { light: { type: 'solid', hex: '#2ED573' }, dark: { type: 'solid', hex: '#2ED573' } },
  filterColor: { light: { type: 'solid', hex: '#3B82F6' }, dark: { type: 'solid', hex: '#3B82F6' } },
  textColor: null,
  freebetBadgeColor: null,
  supportHelplineText: null,
};

beforeEach(() => {
  vi.stubGlobal('location', { ...window.location, hostname: 'betsome.pt' });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getPublicBrand', () => {
  it('resolves the brand by the current hostname when one is configured', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/backend/public/brands/by-domain/betsome.pt') {
        return new Response(JSON.stringify(publicBrand), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await getPublicBrand();

    expect(result).toEqual(publicBrand);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to VITE_BRAND_ID when the hostname has no brand configured', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/backend/public/brands/by-domain/betsome.pt') {
        return new Response(null, { status: 404 });
      }
      if (url === `/backend/public/brands/${import.meta.env.VITE_BRAND_ID}`) {
        return new Response(JSON.stringify(publicBrand), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await getPublicBrand();

    expect(result).toEqual(publicBrand);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns null (never undefined - react-query rejects an undefined queryFn result) when neither the hostname nor the fallback resolve to a brand', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    const result = await getPublicBrand();

    expect(result).toBeNull();
  });
});

describe('getCompetitionRankings', () => {
  it('fetches the ranking list for the given brand', async () => {
    const rankings = [
      { competition: 'EPL', rank: 0 },
      { competition: 'La Liga - Spain', rank: 1 },
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/backend/public/competition-rankings/brand-1') {
        return new Response(JSON.stringify(rankings), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    expect(await getCompetitionRankings('brand-1')).toEqual(rankings);
  });

  it('throws when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

    await expect(getCompetitionRankings('brand-1')).rejects.toThrow();
  });
});

describe('getPromoCards', () => {
  afterEach(() => {
    useAuthStore.setState({ accessToken: null, user: null, isInitialized: false });
  });

  it('attaches the player token when logged in, so the backend can filter out already-redeemed campaign cards', async () => {
    useAuthStore.setState({ accessToken: 'header.payload.signature', user: null, isInitialized: true });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await getPromoCards('brand-1');

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/public/promo-cards/brand-1',
      expect.objectContaining({ headers: { Authorization: 'Bearer header.payload.signature' } }),
    );
  });

  it('sends no Authorization header when logged out', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await getPromoCards('brand-1');

    expect(fetchMock).toHaveBeenCalledWith('/backend/public/promo-cards/brand-1', expect.objectContaining({ headers: {} }));
  });
});
