import type { Match } from '@sportsbook/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStaffAuthStore } from '../features/auth/staffAuthStore';
import type { MarginConfig } from '../lib/backendApi';
import MarginsPage from './MarginsPage';

const footballMatch: Match = {
  id: 'match-1',
  sport: 'Football',
  country: 'England',
  competition: 'Premier League',
  homeTeam: 'Arsenal',
  awayTeam: 'Chelsea',
  kickoff: '2026-07-18T15:00:00Z',
  isLive: false,
  markets: [{ id: 'match-result', name: 'Match Result', selections: [] }],
};

const tennisMatch: Match = {
  id: 'match-2',
  sport: 'Tennis',
  country: 'International',
  competition: 'ATP Finals',
  homeTeam: 'Player A',
  awayTeam: 'Player B',
  kickoff: '2026-07-18T15:00:00Z',
  isLive: false,
  markets: [{ id: 'match-result', name: 'Match Result', selections: [] }],
};

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MarginsPage />
    </QueryClientProvider>,
  );
}

function stubFetch(margins: MarginConfig[]) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method ?? 'GET';

    if (method === 'GET' && url === '/api/events') {
      return new Response(JSON.stringify([footballMatch, tennisMatch]), { status: 200 });
    }
    if (method === 'GET' && url === '/backend/admin/margin-configs') {
      return new Response(JSON.stringify(margins), { status: 200 });
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

describe('MarginsPage', () => {
  it('defaults to the first sport tab and shows its markets', async () => {
    stubFetch([]);
    renderPage();

    expect(await screen.findByRole('button', { name: 'Football', pressed: true })).toBeInTheDocument();
    expect(await screen.findByText('Match Result')).toBeInTheDocument();
  });

  it('switching sport tabs shows that sport\'s own margin value, not the other sport\'s', async () => {
    stubFetch([
      {
        id: 'margin-1',
        brandId: 'brand-1',
        sport: 'Football',
        marketName: 'Match Result',
        tier: 1,
        marginPercent: 20,
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'margin-2',
        brandId: 'brand-1',
        sport: 'Tennis',
        marketName: 'Match Result',
        tier: 1,
        marginPercent: 5,
        createdAt: '',
        updatedAt: '',
      },
    ]);
    renderPage();

    expect(await screen.findByDisplayValue('20')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('5')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Tennis' }));

    expect(await screen.findByDisplayValue('5')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('20')).not.toBeInTheDocument();
  });

  it('setting a margin sends sport/marketName/tier/marginPercent', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'GET' && url === '/api/events') {
        return new Response(JSON.stringify([footballMatch]), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/admin/margin-configs') {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (method === 'POST' && url === '/backend/admin/margin-configs') {
        expect(JSON.parse(init!.body as string)).toEqual({
          sport: 'Football',
          marketName: 'Match Result',
          tier: 1,
          marginPercent: 15,
        });
        return new Response(
          JSON.stringify({
            id: 'margin-3',
            brandId: 'brand-1',
            sport: 'Football',
            marketName: 'Match Result',
            tier: 1,
            marginPercent: 15,
            createdAt: '',
            updatedAt: '',
          }),
          { status: 201 },
        );
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();
    await screen.findByText('Match Result');

    const input = screen.getByLabelText('Match Result tier 1 margin percent');
    await userEvent.type(input, '15');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/margin-configs',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
