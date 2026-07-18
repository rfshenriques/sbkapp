import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPublicBrand, type PublicBrand } from './backendApi';

const publicBrand: PublicBrand = {
  id: 'brand-1',
  name: 'BETPOR',
  logoUrl: null,
  themeMode: 'DARK',
  buttonColorHex: '#E02127',
  highlightColorHex: '#2ED573',
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

  it('returns undefined when neither the hostname nor the fallback resolve to a brand', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    const result = await getPublicBrand();

    expect(result).toBeUndefined();
  });
});
