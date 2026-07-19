import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Brand } from '../lib/backendApi';
import BrandsPage from './BrandsPage';

const existingBrand: Brand = {
  id: 'brand-1',
  name: 'Acme Sportsbook',
  slug: 'acme-sportsbook',
  domain: 'www.acme-sportsbook.com',
  logoUrl: null,
  themeMode: 'DARK',
  buttonColorHex: null,
  highlightColorHex: null,
  filterColorHex: null,
  createdAt: '2026-07-18T00:00:00Z',
  updatedAt: '2026-07-18T00:00:00Z',
  productFlags: [
    { id: 'flag-1', brandId: 'brand-1', product: 'CASHOUT', enabled: true },
    { id: 'flag-2', brandId: 'brand-1', product: 'BET_BUILDER', enabled: false },
  ],
};

function renderBrandsPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <BrandsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('BrandsPage', () => {
  it('lists existing brands with their product flag counts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify([existingBrand]), { status: 200 })),
    );

    renderBrandsPage();

    expect(await screen.findByText('Acme Sportsbook')).toBeInTheDocument();
    expect(screen.getByText('www.acme-sportsbook.com')).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('submits the new-brand form and refetches the list', async () => {
    const createdBrand: Brand = {
      ...existingBrand,
      id: 'brand-2',
      name: 'New Brand',
      slug: 'new-brand',
      domain: null,
      productFlags: [],
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'POST' && url === '/backend/master/brands') {
        expect(JSON.parse(init!.body as string)).toEqual({
          name: 'New Brand',
          slug: 'new-brand',
          domain: undefined,
          themeMode: 'DARK',
        });
        return new Response(JSON.stringify(createdBrand), { status: 201 });
      }
      if (method === 'GET' && url === '/backend/master/brands') {
        return new Response(JSON.stringify([existingBrand]), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderBrandsPage();
    await screen.findByText('Acme Sportsbook');

    await userEvent.type(screen.getByLabelText('Name'), 'New Brand');
    await userEvent.type(screen.getByLabelText('Slug'), 'new-brand');
    await userEvent.click(screen.getByRole('button', { name: 'Add brand' }));

    expect(
      fetchMock.mock.calls.some(([input, init]) => {
        const url = typeof input === 'string' ? input : input.toString();
        return url === '/backend/master/brands' && init?.method === 'POST';
      }),
    ).toBe(true);
  });

  it('shows an empty state when there are no brands', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 })),
    );

    renderBrandsPage();

    expect(await screen.findByText('No brands yet.')).toBeInTheDocument();
  });
});
