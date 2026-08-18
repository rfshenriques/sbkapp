import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Brand, ColorZone } from '../lib/backendApi';
import BrandDetailPage from './BrandDetailPage';

function solidZone(hex: string): ColorZone {
  return { light: { type: 'solid', hex }, dark: { type: 'solid', hex } };
}

const brand: Brand = {
  id: 'brand-1',
  name: 'Acme Sportsbook',
  slug: 'acme-sportsbook',
  domain: 'www.acme-sportsbook.com',
  logoLightUrl: null,
  logoDarkUrl: null,
  shareLogoLightUrl: null,
  shareLogoDarkUrl: null,
  themeMode: 'LIGHT',
  timeFormat: 'H24',
  currencyCode: 'EUR',
  backgroundColor: null,
  surfaceColor: null,
  buttonColor: solidZone('#112233'),
  highlightColor: null,
  filterColor: solidZone('#334455'),
  textColor: null,
  freebetBadgeColor: null,
  freebetStakeReturnedOnWin: true,
  createdAt: '2026-07-18T00:00:00Z',
  updatedAt: '2026-07-18T00:00:00Z',
  productFlags: [{ id: 'flag-1', brandId: 'brand-1', product: 'CASHOUT', enabled: false }],
};

function renderBrandDetailPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/brands/brand-1']}>
        <Routes>
          <Route path="/brands/:id" element={<BrandDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('BrandDetailPage', () => {
  it('loads the brand and prefills the form, including configured color zones', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(brand), { status: 200 })),
    );

    renderBrandDetailPage();

    expect(await screen.findByDisplayValue('Acme Sportsbook')).toBeInTheDocument();
    expect(screen.getByDisplayValue('www.acme-sportsbook.com')).toBeInTheDocument();
    expect(screen.getByLabelText('Default appearance')).toHaveValue('LIGHT');
    expect(screen.getByLabelText('Currency')).toHaveValue('EUR');

    const buttonZone = screen.getByText('Button / CTA').closest('div')!;
    expect(within(buttonZone).getByLabelText('Light color')).toHaveValue('#112233');
    expect(within(buttonZone).getByLabelText('Dark color')).toHaveValue('#112233');

    // Background wasn't configured - its checkbox stays unchecked and no color inputs render for it.
    const backgroundZone = screen.getByText('Background').closest('div')!;
    expect(within(backgroundZone).getByRole('checkbox')).not.toBeChecked();
    expect(within(backgroundZone).queryByLabelText('Light color')).not.toBeInTheDocument();
  });

  it('switching a zone to gradient reveals direction and 2-stop color inputs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(brand), { status: 200 })),
    );

    renderBrandDetailPage();
    await screen.findByDisplayValue('Acme Sportsbook');

    const highlightZone = screen.getByText('Highlight').closest('div')!;
    // Not configured yet - enable it first.
    await userEvent.click(within(highlightZone).getByRole('checkbox'));
    await userEvent.selectOptions(within(highlightZone).getByLabelText('Light type'), 'gradient');

    expect(within(highlightZone).getByLabelText('Light gradient direction')).toBeInTheDocument();
    expect(within(highlightZone).getByLabelText('Light gradient start')).toBeInTheDocument();
    expect(within(highlightZone).getByLabelText('Light gradient end')).toBeInTheDocument();
  });

  it('uploading a logo file POSTs it to the right slot and refreshes the preview from the response', async () => {
    const withLogo: Brand = { ...brand, logoLightUrl: '/backend/public/brands/brand-1/logo/SITE_LIGHT' };

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'POST' && url === '/backend/master/brands/brand-1/logo/SITE_LIGHT') {
        expect(init!.body).toBeInstanceOf(FormData);
        expect((init!.body as FormData).get('file')).toBeInstanceOf(File);
        return new Response(JSON.stringify(withLogo), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/master/brands/brand-1') {
        return new Response(JSON.stringify(brand), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderBrandDetailPage();
    await screen.findByDisplayValue('Acme Sportsbook');
    expect(screen.queryByRole('img', { name: 'Site logo (light) preview' })).not.toBeInTheDocument();

    const file = new File(['fake-bytes'], 'logo.png', { type: 'image/png' });
    await userEvent.upload(screen.getByLabelText('Site logo (light)'), file);

    expect(await screen.findByRole('img', { name: 'Site logo (light) preview' })).toHaveAttribute(
      'src',
      '/backend/public/brands/brand-1/logo/SITE_LIGHT',
    );
  });

  it('removing an uploaded logo sends a DELETE for just that slot', async () => {
    const withLogo: Brand = { ...brand, logoLightUrl: '/backend/public/brands/brand-1/logo/SITE_LIGHT' };

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'DELETE' && url === '/backend/master/brands/brand-1/logo/SITE_LIGHT') {
        return new Response(JSON.stringify(brand), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/master/brands/brand-1') {
        return new Response(JSON.stringify(withLogo), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderBrandDetailPage();
    await screen.findByRole('img', { name: 'Site logo (light) preview' });

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));

    await screen.findByDisplayValue('Acme Sportsbook');
    expect(screen.queryByRole('img', { name: 'Site logo (light) preview' })).not.toBeInTheDocument();
  });

  it('toggling a product flag sends the right PATCH request', async () => {
    const enabledBrand: Brand = {
      ...brand,
      productFlags: [{ id: 'flag-1', brandId: 'brand-1', product: 'CASHOUT', enabled: true }],
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'PATCH' && url === '/backend/master/brands/brand-1/products/CASHOUT') {
        expect(JSON.parse(init!.body as string)).toEqual({ enabled: true });
        return new Response(JSON.stringify(enabledBrand), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/master/brands/brand-1') {
        return new Response(JSON.stringify(brand), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderBrandDetailPage();
    await screen.findByDisplayValue('Acme Sportsbook');

    const cashoutRow = screen.getByText('Cashout').closest('div')!;
    await userEvent.click(within(cashoutRow).getByRole('button', { name: 'Disabled' }));

    expect(await within(cashoutRow).findByRole('button', { name: 'Enabled' })).toBeInTheDocument();
  });

  it('changing the currency and saving sends it in the PATCH payload', async () => {
    const usdBrand: Brand = { ...brand, currencyCode: 'USD' };

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'PATCH' && url === '/backend/master/brands/brand-1') {
        expect(JSON.parse(init!.body as string)).toEqual(expect.objectContaining({ currencyCode: 'USD' }));
        return new Response(JSON.stringify(usdBrand), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/master/brands/brand-1') {
        return new Response(JSON.stringify(brand), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderBrandDetailPage();
    await screen.findByDisplayValue('Acme Sportsbook');

    await userEvent.selectOptions(screen.getByLabelText('Currency'), 'USD');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByLabelText('Currency')).toHaveValue('USD');
  });

  it('changing the time format and saving sends it in the PATCH payload', async () => {
    const h12Brand: Brand = { ...brand, timeFormat: 'H12' };

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'PATCH' && url === '/backend/master/brands/brand-1') {
        expect(JSON.parse(init!.body as string)).toEqual(expect.objectContaining({ timeFormat: 'H12' }));
        return new Response(JSON.stringify(h12Brand), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/master/brands/brand-1') {
        return new Response(JSON.stringify(brand), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderBrandDetailPage();
    await screen.findByDisplayValue('Acme Sportsbook');

    expect(screen.getByLabelText('Time format')).toHaveValue('H24');

    await userEvent.selectOptions(screen.getByLabelText('Time format'), 'H12');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByLabelText('Time format')).toHaveValue('H12');
  });
});
