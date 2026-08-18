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
  document.head.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]').forEach((el) => el.remove());
});

afterEach(() => {
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
});
