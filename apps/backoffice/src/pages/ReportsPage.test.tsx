import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReportSummary, StaffActivityEntry } from '../lib/backendApi';
import ReportsPage from './ReportsPage';

const summary: ReportSummary = {
  from: null,
  to: null,
  betCount: 3,
  totalStakeCents: 1_800,
  settledBetCount: 2,
  settledStakeCents: 1_500,
  settledPayoutCents: 2_000,
  ggrCents: -500,
  statusBreakdown: [
    { status: 'PENDING', count: 1, stakeCents: 300 },
    { status: 'WON', count: 1, stakeCents: 1_000 },
    { status: 'LOST', count: 1, stakeCents: 500 },
  ],
};

const staffActivity: StaffActivityEntry[] = [
  { actorUsername: 'trader_bob', settlementCount: 2 },
  { actorUsername: 'trader_alice', settlementCount: 1 },
];

function renderReportsPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ReportsPage />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ReportsPage', () => {
  it('shows summary cards, status breakdown, and staff activity', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.startsWith('/backend/admin/reports/summary')) {
          return Promise.resolve(new Response(JSON.stringify(summary), { status: 200 }));
        }
        if (url.startsWith('/backend/admin/reports/staff-activity')) {
          return Promise.resolve(new Response(JSON.stringify(staffActivity), { status: 200 }));
        }
        return Promise.resolve(new Response(null, { status: 404 }));
      }),
    );

    renderReportsPage();

    expect(await screen.findByText('3')).toBeInTheDocument(); // bet count
    expect(screen.getByText('18.00')).toBeInTheDocument(); // total stake
    expect(screen.getByText('-5.00')).toBeInTheDocument(); // GGR
    expect(screen.getByText('trader_bob')).toBeInTheDocument();
    expect(screen.getByText('trader_alice')).toBeInTheDocument();
  });

  it('refetches with the selected date range', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.startsWith('/backend/admin/reports/summary')) {
        return Promise.resolve(new Response(JSON.stringify(summary), { status: 200 }));
      }
      if (url.startsWith('/backend/admin/reports/staff-activity')) {
        return Promise.resolve(new Response(JSON.stringify(staffActivity), { status: 200 }));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderReportsPage();
    await screen.findByText('trader_bob');

    await userEvent.type(screen.getByLabelText('From'), '2026-07-01');

    expect(
      fetchMock.mock.calls.some(([input]) => {
        const url = typeof input === 'string' ? input : input.toString();
        return url === '/backend/admin/reports/summary?from=2026-07-01';
      }),
    ).toBe(true);
  });
});
