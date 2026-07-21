import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GgrTimeSeriesPoint, MarketingSpend, TimeSeriesPoint } from '../lib/backendApi';
import RegistrationsPage from './RegistrationsPage';

const registrations: TimeSeriesPoint[] = [
  { bucket: '2026-07-01T00:00:00.000Z', count: 3 },
  { bucket: '2026-07-02T00:00:00.000Z', count: 5 },
];

const ggr: GgrTimeSeriesPoint[] = [
  { bucket: '2026-07-01T00:00:00.000Z', ggrCents: -1_000 },
  { bucket: '2026-07-02T00:00:00.000Z', ggrCents: 500 },
];

function stubFetch({
  registrationsData = registrations,
  ggrData = ggr,
  spendData = [] as MarketingSpend[],
} = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.startsWith('/backend/admin/reports/registrations-time-series')) {
        return Promise.resolve(new Response(JSON.stringify(registrationsData), { status: 200 }));
      }
      if (url.startsWith('/backend/admin/reports/ggr-time-series')) {
        return Promise.resolve(new Response(JSON.stringify(ggrData), { status: 200 }));
      }
      if (url.startsWith('/backend/admin/marketing-spend')) {
        return Promise.resolve(new Response(JSON.stringify(spendData), { status: 200 }));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    }),
  );
}

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <RegistrationsPage />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RegistrationsPage', () => {
  it('renders registrations and GGR charts once data loads', async () => {
    stubFetch();
    renderPage();

    expect(await screen.findByRole('heading', { level: 1, name: 'Registrations' })).toBeInTheDocument();
    expect(await screen.findByText('GGR')).toBeInTheDocument();
  });

  it('shows an honest empty state when there is no data in range', async () => {
    stubFetch({ registrationsData: [], ggrData: [] });
    renderPage();

    const emptyMessages = await screen.findAllByText('No data in this range.');
    expect(emptyMessages).toHaveLength(2);
  });

  it('labels the GGR chart as a comparison once marketing spend exists in range', async () => {
    stubFetch({
      spendData: [
        {
          id: 'spend-1',
          brandId: 'brand-1',
          date: '2026-07-01T00:00:00.000Z',
          channel: 'Google Ads',
          amountCents: 2_000,
          createdByUsername: 'admin_bob',
          createdAt: '2026-07-01T00:00:00.000Z',
        },
      ],
    });
    renderPage();

    expect(await screen.findByText('GGR vs marketing spend')).toBeInTheDocument();
  });

  it('does not claim a spend comparison when no spend has been logged', async () => {
    stubFetch();
    renderPage();

    await screen.findByText('GGR');
    expect(screen.queryByText('GGR vs marketing spend')).not.toBeInTheDocument();
  });
});
