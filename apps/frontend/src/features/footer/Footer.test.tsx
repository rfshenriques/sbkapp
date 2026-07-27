import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBrandStore } from '../brand/brandStore';
import { Footer } from './Footer';

const TEST_BRAND_ID = 'brand-1';

function stubFetch({
  sponsorLogos = [] as { id: string }[],
  paymentMethods = [] as { id: string }[],
  supportHelplineText = null as string | null,
} = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.startsWith('/backend/public/brands/by-domain/')) {
        return new Response(
          JSON.stringify({
            id: TEST_BRAND_ID,
            name: 'Test Brand',
            logoUrl: null,
            themeMode: 'DARK',
            buttonColorHex: null,
            highlightColorHex: null,
            filterColorHex: null,
            supportHelplineText,
          }),
          { status: 200 },
        );
      }
      if (url === `/backend/public/brand-image-list/${TEST_BRAND_ID}/SPONSOR_LOGO`) {
        return new Response(
          JSON.stringify(sponsorLogos.map((item) => ({ ...item, brandId: TEST_BRAND_ID, kind: 'SPONSOR_LOGO', mimeType: 'image/png', sortOrder: 0 }))),
          { status: 200 },
        );
      }
      if (url === `/backend/public/brand-image-list/${TEST_BRAND_ID}/PAYMENT_METHOD`) {
        return new Response(
          JSON.stringify(paymentMethods.map((item) => ({ ...item, brandId: TEST_BRAND_ID, kind: 'PAYMENT_METHOD', mimeType: 'image/png', sortOrder: 0 }))),
          { status: 200 },
        );
      }
      return new Response(null, { status: 404 });
    }),
  );
}

function renderFooter() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useBrandStore.setState({ brandId: TEST_BRAND_ID });
});

afterEach(() => {
  vi.unstubAllGlobals();
  useBrandStore.setState({ brandId: undefined });
});

describe('Footer', () => {
  it('always shows the useful links and responsible gambling note', async () => {
    stubFetch();
    renderFooter();

    expect(await screen.findByRole('link', { name: 'Challenges' })).toHaveAttribute('href', '/challenges');
    expect(screen.getByRole('link', { name: 'Live' })).toHaveAttribute('href', '/live');
    expect(screen.getByRole('link', { name: 'Responsible Gambling' })).toHaveAttribute(
      'href',
      '/responsible-gambling',
    );
    expect(screen.getByText(/18\+ Play responsibly/)).toBeInTheDocument();
  });

  it('hides the sponsors and payment methods sections when no images are uploaded', async () => {
    stubFetch();
    renderFooter();

    await screen.findByRole('link', { name: 'Challenges' });
    expect(screen.queryByText('Sponsors')).not.toBeInTheDocument();
    expect(screen.queryByText('Payment methods')).not.toBeInTheDocument();
  });

  it('shows sponsor logos once the brand has uploaded some', async () => {
    stubFetch({ sponsorLogos: [{ id: 'logo-1' }, { id: 'logo-2' }] });
    renderFooter();

    expect(await screen.findByText('Sponsors')).toBeInTheDocument();
    const images = screen.getAllByRole('img', { name: 'Sponsor' });
    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAttribute('src', `/backend/public/brand-image-list/${TEST_BRAND_ID}/item/logo-1`);
  });

  it('shows the configured helpline text when the brand has set one', async () => {
    stubFetch({ supportHelplineText: 'Call 1-800-SUPPORT for help.' });
    renderFooter();

    expect(await screen.findByText('Call 1-800-SUPPORT for help.')).toBeInTheDocument();
  });

  it('shows nothing image-related when brandId has not resolved yet', () => {
    useBrandStore.setState({ brandId: undefined });
    stubFetch();
    renderFooter();

    expect(screen.queryByText('Sponsors')).not.toBeInTheDocument();
    expect(screen.queryByText('Payment methods')).not.toBeInTheDocument();
  });
});
