import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStaffAuthStore } from '../features/auth/staffAuthStore';
import type { StakeLimit } from '../lib/backendApi';
import StakeLimitsPage from './StakeLimitsPage';

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <StakeLimitsPage />
    </QueryClientProvider>,
  );
}

function stubList(limits: StakeLimit[]) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method ?? 'GET';
    if (method === 'GET' && url === '/backend/admin/stake-limits') {
      return new Response(JSON.stringify(limits), { status: 200 });
    }
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  useStaffAuthStore.setState({
    accessToken: 'header.payload.signature',
    user: { sub: 'staff-1', username: 'trader_bob', role: 'TRADING' },
    isInitialized: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const sampleLimit: StakeLimit = {
  id: 'limit-1',
  brandId: 'brand-1',
  scope: 'SPORT',
  scopeValue: 'Football',
  tier: 0,
  maxStakeCents: 100_000,
  maxLiabilityCents: 500_000,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('StakeLimitsPage', () => {
  it('shows an empty state when nothing is configured', async () => {
    stubList([]);
    renderPage();

    expect(await screen.findByText('No limits configured yet - bets are unbounded.')).toBeInTheDocument();
  });

  it('lists existing limits', async () => {
    stubList([sampleLimit]);
    renderPage();

    const row = (await screen.findByText('Football')).closest('tr')!;
    expect(within(row).getByText('Sport')).toBeInTheDocument();
    expect(within(row).getByText('€1000.00')).toBeInTheDocument();
    expect(within(row).getByText('€5000.00')).toBeInTheDocument();
  });

  it('adds a new limit via POST', async () => {
    let limits: StakeLimit[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'GET' && url === '/backend/admin/stake-limits') {
        return new Response(JSON.stringify(limits), { status: 200 });
      }
      if (method === 'POST' && url === '/backend/admin/stake-limits') {
        expect(JSON.parse(init!.body as string)).toEqual({
          scope: 'SPORT',
          scopeValue: 'Tennis',
          tier: 0,
          maxStakeCents: 40_000,
          maxLiabilityCents: null,
        });
        const created = { ...sampleLimit, id: 'limit-2', scopeValue: 'Tennis' };
        limits = [created];
        return new Response(JSON.stringify(created), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();
    await screen.findByText('No limits configured yet - bets are unbounded.');

    await userEvent.type(screen.getByPlaceholderText('e.g. Football'), 'Tennis');
    await userEvent.type(screen.getByLabelText('Max stake (EUR)'), '400');
    await userEvent.click(screen.getByRole('button', { name: 'Add limit' }));

    expect(await screen.findByText('Tennis')).toBeInTheDocument();
  });

  it('removes a limit via DELETE', async () => {
    let limits: StakeLimit[] = [sampleLimit];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'GET' && url === '/backend/admin/stake-limits') {
        return new Response(JSON.stringify(limits), { status: 200 });
      }
      if (method === 'DELETE' && url === '/backend/admin/stake-limits/limit-1') {
        limits = [];
        return new Response(JSON.stringify(sampleLimit), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Remove' }));

    expect(await screen.findByText('No limits configured yet - bets are unbounded.')).toBeInTheDocument();
  });
});
