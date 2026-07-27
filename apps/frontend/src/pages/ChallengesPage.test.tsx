import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBrandStore } from '../features/brand/brandStore';
import ChallengesPage from './ChallengesPage';

const TEST_BRAND_ID = 'brand-1';

function stubFetch(cards: unknown[] = []) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === `/backend/public/promo-cards/${TEST_BRAND_ID}`) {
        return new Response(JSON.stringify(cards), { status: 200 });
      }
      return new Response(null, { status: 404 });
    }),
  );
}

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ChallengesPage />
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

describe('ChallengesPage', () => {
  it('shows a loading skeleton instead of the empty state while the fetch is in flight', () => {
    stubFetch([]);
    renderPage();

    expect(screen.getByRole('status', { name: 'Loading challenges' })).toBeInTheDocument();
    expect(screen.queryByText(/No active challenges right now/)).not.toBeInTheDocument();
  });

  it('shows an honest empty state rather than fabricated promo content', async () => {
    stubFetch([]);
    renderPage();

    expect(screen.getByRole('heading', { name: 'Challenges' })).toBeInTheDocument();
    expect(await screen.findByText(/No active challenges right now/)).toBeInTheDocument();
  });

  it('renders promo cards linking to their campaign when the brand has some', async () => {
    stubFetch([
      {
        id: 'card-1',
        mimeType: 'image/png',
        title: 'Champions League Promo',
        subtitle: 'Bet & get €10',
        sortOrder: 0,
        betAndGetCampaignId: 'campaign-1',
      },
    ]);
    renderPage();

    expect(await screen.findByText('Champions League Promo')).toBeInTheDocument();
    expect(screen.getByText('Bet & get €10')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/campaigns/campaign-1');
    expect(screen.queryByText(/No active challenges right now/)).not.toBeInTheDocument();
  });
});
