import type { Match } from '@sportsbook/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStaffAuthStore } from '../features/auth/staffAuthStore';
import type { Boost, OddsLadderRung } from '../lib/backendApi';
import BoostsPage from './BoostsPage';

const liveMatch: Match = {
  id: 'match-1',
  sport: 'Football',
  country: 'England',
  competition: 'Premier League',
  homeTeam: 'Arsenal',
  awayTeam: 'Chelsea',
  kickoff: '2026-07-18T15:00:00Z',
  isLive: false,
  markets: [],
};

const matchWithMarkets: Match = {
  ...liveMatch,
  markets: [
    {
      id: 'match-result',
      name: 'Match Result',
      selections: [
        { id: 'home', name: 'Home', odds: 2.0 },
        { id: 'away', name: 'Away', odds: 3.2 },
      ],
    },
  ],
};

const ladderRungs: OddsLadderRung[] = [
  { id: 'r1', value: 2.0, createdAt: '2026-07-18T00:00:00Z' },
  { id: 'r2', value: 2.02, createdAt: '2026-07-18T00:00:00Z' },
  { id: 'r3', value: 2.04, createdAt: '2026-07-18T00:00:00Z' },
];

function renderBoostsPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <BoostsPage />
    </QueryClientProvider>,
  );
}

function stubFetch(boosts: Boost[]) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method ?? 'GET';

    if (method === 'GET' && url === '/api/events') {
      return new Response(JSON.stringify([liveMatch]), { status: 200 });
    }
    if (method === 'GET' && url === '/api/events/match-1') {
      return new Response(JSON.stringify(matchWithMarkets), { status: 200 });
    }
    if (method === 'GET' && url === '/backend/admin/boosts') {
      return new Response(JSON.stringify(boosts), { status: 200 });
    }
    if (method === 'GET' && url === '/backend/admin/odds-ladder') {
      return new Response(JSON.stringify(ladderRungs), { status: 200 });
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

async function drillToLeague() {
  await userEvent.click(await screen.findByRole('button', { name: /Football/ }));
  await userEvent.click(screen.getByRole('button', { name: /England/ }));
  await userEvent.click(screen.getByRole('button', { name: /Premier League/ }));
}

describe('BoostsPage', () => {
  it('lists live matches from the odds-engine once drilled into their league', async () => {
    stubFetch([]);
    renderBoostsPage();
    await drillToLeague();

    expect(await screen.findByText(/Arsenal vs Chelsea/)).toBeInTheDocument();
  });

  it('expanding a match then a market shows each selection with its feed odds and a ticks input', async () => {
    stubFetch([]);
    renderBoostsPage();
    await drillToLeague();

    await userEvent.click(await screen.findByText(/Arsenal vs Chelsea/));
    await userEvent.click(await screen.findByText('Match Result'));

    expect(await screen.findByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Feed 2.00')).toBeInTheDocument();
    expect(screen.getByLabelText('Ticks for home')).toBeInTheDocument();
  });

  it('setting a boost sends matchId/marketId/selectionId/ticks, shows a live preview, and the Boosted badge', async () => {
    let boosts: Boost[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'GET' && url === '/api/events') {
        return new Response(JSON.stringify([liveMatch]), { status: 200 });
      }
      if (method === 'GET' && url === '/api/events/match-1') {
        return new Response(JSON.stringify(matchWithMarkets), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/admin/boosts') {
        return new Response(JSON.stringify(boosts), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/admin/odds-ladder') {
        return new Response(JSON.stringify(ladderRungs), { status: 200 });
      }
      if (method === 'POST' && url === '/backend/admin/boosts') {
        expect(JSON.parse(init!.body as string)).toEqual({
          matchId: 'match-1',
          marketId: 'match-result',
          selectionId: 'home',
          ticks: 2,
          reason: undefined,
        });
        boosts = [
          {
            id: 'boost-1',
            matchId: 'match-1',
            marketId: 'match-result',
            selectionId: 'home',
            ticks: 2,
            reason: null,
            createdAt: '2026-07-18T00:00:00Z',
            updatedAt: '2026-07-18T00:00:00Z',
            maxStakeCents: null,
            maxLiabilityCents: null,
            currentLiabilityCents: 0,
            disabledAt: null,
            audienceMode: 'ALL',
            audienceSegments: [],
          },
        ];
        return new Response(JSON.stringify(boosts[0]), { status: 201 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderBoostsPage();
    await drillToLeague();
    await userEvent.click(await screen.findByText(/Arsenal vs Chelsea/));
    await userEvent.click(await screen.findByText('Match Result'));

    const ticksInput = await screen.findByLabelText('Ticks for home');
    await userEvent.type(ticksInput, '2');
    // Home is priced 2.00 on the ladder; +2 ticks -> 2.04.
    expect(await screen.findByText('→ 2.04')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Set' }));

    expect(await screen.findByText('Boosted')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Clear' })).toBeInTheDocument();
  });

  it('clearing a boost sends a DELETE for its id', async () => {
    let boosts: Boost[] = [
      {
        id: 'boost-1',
        matchId: 'match-1',
        marketId: 'match-result',
        selectionId: 'home',
        ticks: 2,
        reason: null,
        createdAt: '2026-07-18T00:00:00Z',
        updatedAt: '2026-07-18T00:00:00Z',
        maxStakeCents: null,
        maxLiabilityCents: null,
        currentLiabilityCents: 0,
        disabledAt: null,
        audienceMode: 'ALL',
        audienceSegments: [],
      },
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'GET' && url === '/api/events') {
        return new Response(JSON.stringify([liveMatch]), { status: 200 });
      }
      if (method === 'GET' && url === '/api/events/match-1') {
        return new Response(JSON.stringify(matchWithMarkets), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/admin/boosts') {
        return new Response(JSON.stringify(boosts), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/admin/odds-ladder') {
        return new Response(JSON.stringify(ladderRungs), { status: 200 });
      }
      if (method === 'DELETE' && url === '/backend/admin/boosts/boost-1') {
        boosts = [];
        return new Response(null, { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderBoostsPage();
    await drillToLeague();
    await userEvent.click(await screen.findByText(/Arsenal vs Chelsea/));
    await userEvent.click(await screen.findByText('Match Result'));

    expect(await screen.findByText('Boosted')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/boosts/boost-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('saving max stake/liability sends a PATCH to the limits endpoint', async () => {
    const boosts: Boost[] = [
      {
        id: 'boost-1',
        matchId: 'match-1',
        marketId: 'match-result',
        selectionId: 'home',
        ticks: 2,
        reason: null,
        createdAt: '2026-07-18T00:00:00Z',
        updatedAt: '2026-07-18T00:00:00Z',
        maxStakeCents: null,
        maxLiabilityCents: null,
        currentLiabilityCents: 0,
        disabledAt: null,
        audienceMode: 'ALL',
        audienceSegments: [],
      },
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'GET' && url === '/api/events') {
        return new Response(JSON.stringify([liveMatch]), { status: 200 });
      }
      if (method === 'GET' && url === '/api/events/match-1') {
        return new Response(JSON.stringify(matchWithMarkets), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/admin/boosts') {
        return new Response(JSON.stringify(boosts), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/admin/odds-ladder') {
        return new Response(JSON.stringify(ladderRungs), { status: 200 });
      }
      if (method === 'PATCH' && url === '/backend/admin/boosts/boost-1/limits') {
        expect(JSON.parse(init!.body as string)).toEqual({
          maxStakeCents: 10_000,
          maxLiabilityCents: null,
          audienceMode: 'ALL',
          segmentIds: [],
        });
        return new Response(JSON.stringify(boosts[0]), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderBoostsPage();
    await drillToLeague();
    await userEvent.click(await screen.findByText(/Arsenal vs Chelsea/));
    await userEvent.click(await screen.findByText('Match Result'));

    await userEvent.type(await screen.findByLabelText('Boost home limits max stake'), '100');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/boosts/boost-1/limits',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });
});
