import type { Match } from '@sportsbook/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStaffAuthStore } from '../features/auth/staffAuthStore';
import type { CompetitionRanking } from '../lib/backendApi';
import CompetitionRankingPage from './CompetitionRankingPage';

const eplMatch: Match = {
  id: 'match-1',
  sport: 'Football',
  country: 'England',
  competition: 'EPL',
  homeTeam: 'Arsenal',
  awayTeam: 'Chelsea',
  kickoff: '2026-07-18T15:00:00Z',
  isLive: false,
  markets: [],
};

const laLigaMatch: Match = {
  id: 'match-2',
  sport: 'Football',
  country: 'Spain',
  competition: 'La Liga',
  homeTeam: 'Barcelona',
  awayTeam: 'Real Madrid',
  kickoff: '2026-07-18T18:00:00Z',
  isLive: false,
  markets: [],
};

const eplRanking: CompetitionRanking = {
  id: 'ranking-1',
  brandId: 'brand-1',
  competition: 'EPL',
  rank: 1,
  createdAt: '2026-07-18T00:00:00Z',
  updatedAt: '2026-07-18T00:00:00Z',
};

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <CompetitionRankingPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useStaffAuthStore.setState({
    accessToken: 'header.payload.signature',
    user: { sub: 'staff-1', username: 'cms_alice', role: 'CMS' },
    isInitialized: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function expandFootball() {
  await userEvent.click(await screen.findByRole('button', { name: /^Football/ }));
}

describe('CompetitionRankingPage', () => {
  it('groups rankings by sport, one expanded at a time', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/events') {
        return new Response(JSON.stringify([eplMatch, laLigaMatch]), { status: 200 });
      }
      if (url === '/backend/admin/competition-rankings') {
        return new Response(JSON.stringify([eplRanking]), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    expect(await screen.findByRole('button', { name: /^Football \(1\)/ })).toBeInTheDocument();
    expect(screen.queryByText('EPL')).not.toBeInTheDocument();

    await expandFootball();
    expect(await screen.findByText('EPL')).toBeInTheDocument();
    expect(screen.getByText('La Liga')).toBeInTheDocument();
  });

  it('lists the ranked competition alongside every other competition available to add', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/events') {
        return new Response(JSON.stringify([eplMatch, laLigaMatch]), { status: 200 });
      }
      if (url === '/backend/admin/competition-rankings') {
        return new Response(JSON.stringify([eplRanking]), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();
    await expandFootball();

    expect(await screen.findByText('EPL')).toBeInTheDocument();
    expect(await screen.findByText('La Liga')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add to ranking' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  it('shows a "No matches" badge for a ranked competition with none in the current feed', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/events') {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (url === '/backend/admin/competition-rankings') {
        return new Response(JSON.stringify([eplRanking]), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();
    // No live matches at all, so EPL's sport can't be resolved from feed evidence - it falls under "Other".
    await userEvent.click(await screen.findByRole('button', { name: /^Other/ }));

    expect(await screen.findByText('EPL')).toBeInTheDocument();
    expect(await screen.findByText('No matches')).toBeInTheDocument();
  });

  it('adding an available competition posts it at the next rank', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'GET' && url === '/api/events') {
        return new Response(JSON.stringify([eplMatch, laLigaMatch]), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/admin/competition-rankings') {
        return new Response(JSON.stringify([eplRanking]), { status: 200 });
      }
      if (method === 'POST' && url === '/backend/admin/competition-rankings') {
        expect(JSON.parse(init!.body as string)).toEqual({ competition: 'La Liga', rank: 2 });
        return new Response(
          JSON.stringify({ ...eplRanking, id: 'ranking-2', competition: 'La Liga', rank: 2 }),
          { status: 200 },
        );
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();
    await expandFootball();
    await screen.findByText('La Liga');

    await userEvent.click(screen.getByRole('button', { name: 'Add to ranking' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/competition-rankings',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('removing a ranked competition sends a delete for its ranking id', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'GET' && url === '/api/events') {
        return new Response(JSON.stringify([eplMatch]), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/admin/competition-rankings') {
        return new Response(JSON.stringify([eplRanking]), { status: 200 });
      }
      if (method === 'DELETE' && url === '/backend/admin/competition-rankings/ranking-1') {
        return new Response(JSON.stringify(eplRanking), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();
    await expandFootball();
    await screen.findByText('EPL');

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/competition-rankings/ranking-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
