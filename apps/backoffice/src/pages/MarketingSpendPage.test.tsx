import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MarketingSpend } from '../lib/backendApi';
import MarketingSpendPage from './MarketingSpendPage';

const entries: MarketingSpend[] = [
  {
    id: 'spend-1',
    brandId: 'brand-1',
    date: '2026-07-01T00:00:00.000Z',
    channel: 'Google Ads',
    amountCents: 10_000,
    createdByUsername: 'admin_bob',
    createdAt: '2026-07-01T00:00:00.000Z',
  },
];

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MarketingSpendPage />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MarketingSpendPage', () => {
  it('lists existing spend entries', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.startsWith('/backend/admin/marketing-spend')) {
          return Promise.resolve(new Response(JSON.stringify(entries), { status: 200 }));
        }
        return Promise.resolve(new Response(null, { status: 404 }));
      }),
    );

    renderPage();

    expect(await screen.findByText('Google Ads')).toBeInTheDocument();
    expect(screen.getByText('100.00')).toBeInTheDocument();
    expect(screen.getByText('admin_bob')).toBeInTheDocument();
  });

  it('shows an honest empty state with no entries', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 })));

    renderPage();

    expect(await screen.findByText('No spend entries recorded yet.')).toBeInTheDocument();
  });

  it('submits a new entry and refetches the list', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/backend/admin/marketing-spend' && init?.method === 'POST') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 'spend-2',
              brandId: 'brand-1',
              date: '2026-07-10T00:00:00.000Z',
              channel: 'Affiliates',
              amountCents: 2_500,
              createdByUsername: 'admin_bob',
              createdAt: '2026-07-10T00:00:00.000Z',
            }),
            { status: 201 },
          ),
        );
      }
      if (url.startsWith('/backend/admin/marketing-spend')) {
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();
    await screen.findByText('No spend entries recorded yet.');

    await userEvent.type(screen.getByLabelText('Date'), '2026-07-10');
    await userEvent.type(screen.getByLabelText('Channel'), 'Affiliates');
    await userEvent.type(screen.getByLabelText('Amount'), '25');
    await userEvent.click(screen.getByRole('button', { name: 'Add entry' }));

    expect(
      fetchMock.mock.calls.some(([input, init]) => {
        const url = typeof input === 'string' ? input : input.toString();
        return url === '/backend/admin/marketing-spend' && (init as RequestInit)?.method === 'POST';
      }),
    ).toBe(true);
  });
});
