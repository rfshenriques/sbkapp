import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicBrand } from '../../lib/backendApi';
import { useBrandTheme } from './useBrandTheme';

const publicBrand: PublicBrand = {
  id: 'brand-1',
  name: 'BETPOR',
  logoLightUrl: 'https://cdn.example.com/betpor-light.png',
  logoDarkUrl: 'https://cdn.example.com/betpor-dark.png',
  shareLogoLightUrl: null,
  shareLogoDarkUrl: null,
  appIconUrl: null,
  themeMode: 'DARK',
  currencyCode: 'EUR',
  timeFormat: 'H24',
  backgroundColor: null,
  surfaceColor: null,
  buttonColor: null,
  highlightColor: null,
  filterColor: null,
  textColor: null,
  freebetBadgeColor: null,
  supportHelplineText: null,
};

function renderWithClient() {
  const queryClient = new QueryClient();
  return renderHook(() => useBrandTheme(), {
    wrapper: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
  });
}

beforeEach(() => {
  vi.stubGlobal('location', { ...window.location, hostname: 'betsome.pt' });
  document.head
    .querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"], link[rel="manifest"]')
    .forEach((el) => el.remove());
});

afterEach(() => {
  document.head.querySelectorAll('link[rel="manifest"]').forEach((el) => el.remove());
  vi.unstubAllGlobals();
});

describe('useBrandTheme', () => {
  it("points the browser tab icon and iOS home-screen icon at the brand's own logo, creating the link tags if index.html had none", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(publicBrand), { status: 200 })),
    );

    renderWithClient();

    await waitFor(() => {
      const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      expect(favicon?.href).toBe('https://cdn.example.com/betpor-dark.png');
    });
    const appleTouchIcon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    expect(appleTouchIcon?.href).toBe('https://cdn.example.com/betpor-dark.png');
  });

  it('leaves any existing favicon link alone when the brand has no logo configured at all', async () => {
    const existing = document.createElement('link');
    existing.rel = 'icon';
    existing.href = 'https://original.example.com/icon-192.png';
    document.head.appendChild(existing);

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ ...publicBrand, logoLightUrl: null, logoDarkUrl: null }), { status: 200 }),
      ),
    );

    const { result } = renderWithClient();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.href).toBe(
      'https://original.example.com/icon-192.png',
    );
  });

  it("prefers the brand's dedicated app icon over the header logo for the favicon/apple-touch-icon", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ ...publicBrand, appIconUrl: 'https://cdn.example.com/betpor-app-icon.png' }),
            { status: 200 },
          ),
      ),
    );

    renderWithClient();

    await waitFor(() => {
      const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      expect(favicon?.href).toBe('https://cdn.example.com/betpor-app-icon.png');
    });
    expect(document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')?.href).toBe(
      'https://cdn.example.com/betpor-app-icon.png',
    );
  });

  it("swaps the PWA manifest link to a per-brand blob built from the brand's app icon, so the Android/desktop install prompt isn't stuck with the generic static one", async () => {
    const manifestLink = document.createElement('link');
    manifestLink.rel = 'manifest';
    manifestLink.href = '/manifest.webmanifest';
    document.head.appendChild(manifestLink);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake-manifest');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ ...publicBrand, appIconUrl: 'https://cdn.example.com/betpor-app-icon.png' }),
            { status: 200 },
          ),
      ),
    );

    renderWithClient();

    await waitFor(() => expect(manifestLink.href).toBe('blob:fake-manifest'));
    const [blobArg] = vi.mocked(URL.createObjectURL).mock.calls[0]!;
    const manifestJson = await (blobArg as Blob).text();
    expect(JSON.parse(manifestJson)).toMatchObject({
      name: 'BETPOR',
      icons: [{ src: 'https://cdn.example.com/betpor-app-icon.png', sizes: 'any' }],
    });
  });

  it('leaves the static manifest link alone when the brand has no dedicated app icon configured', async () => {
    const manifestLink = document.createElement('link');
    manifestLink.rel = 'manifest';
    manifestLink.href = '/manifest.webmanifest';
    document.head.appendChild(manifestLink);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(publicBrand), { status: 200 })),
    );

    const { result } = renderWithClient();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(manifestLink.href).not.toMatch(/^blob:/);
    expect(manifestLink.getAttribute('href')).toBe('/manifest.webmanifest');
  });
});
