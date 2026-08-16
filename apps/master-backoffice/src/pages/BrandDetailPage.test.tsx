import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Brand } from '../lib/backendApi';
import BrandDetailPage from './BrandDetailPage';

const brand: Brand = {
  id: 'brand-1',
  name: 'Acme Sportsbook',
  slug: 'acme-sportsbook',
  domain: 'www.acme-sportsbook.com',
  logoUrl: null,
  themeMode: 'LIGHT',
  buttonColorHex: '#112233',
  highlightColorHex: null,
  filterColorHex: '#334455',
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
  it('loads the brand and prefills the form', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(brand), { status: 200 })),
    );

    renderBrandDetailPage();

    expect(await screen.findByDisplayValue('Acme Sportsbook')).toBeInTheDocument();
    expect(screen.getByDisplayValue('www.acme-sportsbook.com')).toBeInTheDocument();
    // The hex text input and its paired native color-swatch input share the
    // same value once it's a valid 6-digit hex - getByLabelText scopes to
    // just the text input (the swatch's accessible name has its own
    // "... swatch" suffix, see BrandDetailPage.tsx).
    expect(screen.getByLabelText('Button color')).toHaveValue('#112233');
    expect(screen.getByLabelText('Filter color')).toHaveValue('#334455');
    expect(screen.getByLabelText('Appearance')).toHaveValue('LIGHT');
  });

  it('uploading a logo file POSTs it and refreshes the preview from the response', async () => {
    const withLogo: Brand = { ...brand, logoUrl: '/backend/public/brands/brand-1/logo' };

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'POST' && url === '/backend/master/brands/brand-1/logo') {
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
    expect(screen.queryByRole('img', { name: 'Brand logo preview' })).not.toBeInTheDocument();

    const file = new File(['fake-bytes'], 'logo.png', { type: 'image/png' });
    await userEvent.upload(screen.getByLabelText('Upload from computer'), file);

    expect(await screen.findByRole('img', { name: 'Brand logo preview' })).toHaveAttribute(
      'src',
      '/backend/public/brands/brand-1/logo',
    );
    expect(screen.getByLabelText('Logo URL')).toHaveValue('/backend/public/brands/brand-1/logo');
  });

  it('removing an uploaded logo sends a DELETE and clears the field', async () => {
    const withLogo: Brand = { ...brand, logoUrl: '/backend/public/brands/brand-1/logo' };

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'DELETE' && url === '/backend/master/brands/brand-1/logo') {
        return new Response(JSON.stringify(brand), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/master/brands/brand-1') {
        return new Response(JSON.stringify(withLogo), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderBrandDetailPage();
    await screen.findByRole('img', { name: 'Brand logo preview' });

    await userEvent.click(screen.getByRole('button', { name: 'Remove logo' }));

    await screen.findByLabelText('Logo URL');
    expect(screen.getByLabelText('Logo URL')).toHaveValue('');
    expect(screen.queryByRole('img', { name: 'Brand logo preview' })).not.toBeInTheDocument();
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
});
