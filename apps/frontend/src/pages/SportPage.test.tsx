import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Match } from '@sportsbook/shared';
import { stubOddsEngineFetch } from '../test/mockOddsEngine';
import { useBrandStore } from '../features/brand/brandStore';
import SportPage from './SportPage';

function buildMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'm1',
    sport: 'Football',
    competition: 'EPL',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    kickoff: '2026-07-19T18:00:00Z',
    isLive: false,
    markets: [],
    ...overrides,
  };
}

function stubRankingsFetch(rankings: { competition: string; rank: number }[] = []) {
  const existingFetch = globalThis.fetch;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.startsWith('/backend/public/competition-rankings/')) {
      return new Response(JSON.stringify(rankings), { status: 200 });
    }
    return existingFetch(input as never, init);
  });
  vi.stubGlobal('fetch', fetchMock);
}

function renderAt(path: string) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/sports/:sport" element={<SportPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useBrandStore.setState({ brandId: 'brand-1' });
});

afterEach(() => {
  vi.unstubAllGlobals();
  useBrandStore.setState({ brandId: undefined });
});

describe('SportPage', () => {
  it('filters to matches for the sport in the URL', async () => {
    stubOddsEngineFetch([
      buildMatch({ id: 'm1', sport: 'Football', homeTeam: 'Arsenal', awayTeam: 'Chelsea' }),
      buildMatch({ id: 'm2', sport: 'Ice Hockey', homeTeam: 'Bruins', awayTeam: 'Rangers' }),
    ]);
    stubRankingsFetch();

    renderAt('/sports/Football');

    expect(await screen.findByText('Arsenal vs Chelsea')).toBeInTheDocument();
    expect(screen.queryByText('Bruins vs Rangers')).not.toBeInTheDocument();
  });

  it('shows every sport when the URL param is "all"', async () => {
    stubOddsEngineFetch([
      buildMatch({ id: 'm1', sport: 'Football', homeTeam: 'Arsenal', awayTeam: 'Chelsea' }),
      buildMatch({ id: 'm2', sport: 'Ice Hockey', homeTeam: 'Bruins', awayTeam: 'Rangers' }),
    ]);
    stubRankingsFetch();

    renderAt('/sports/all');

    expect(await screen.findByText('Arsenal vs Chelsea')).toBeInTheDocument();
    expect(screen.getByText('Bruins vs Rangers')).toBeInTheDocument();
  });

  it('sorts by importance rank when that mode is selected', async () => {
    stubOddsEngineFetch([
      buildMatch({
        id: 'minor',
        competition: 'League Two',
        kickoff: '2026-07-19T09:00:00Z',
        homeTeam: 'Small Club',
        awayTeam: 'Tiny Club',
      }),
      buildMatch({
        id: 'major',
        competition: 'Champions League',
        kickoff: '2026-07-19T22:00:00Z',
        homeTeam: 'Big Club',
        awayTeam: 'Huge Club',
      }),
    ]);
    stubRankingsFetch([
      { competition: 'Champions League', rank: 0 },
      { competition: 'League Two', rank: 10 },
    ]);

    renderAt('/sports/all');
    await screen.findByText('Small Club vs Tiny Club');

    // Default "Time" mode: minor match kicks off first.
    let headings = screen.getAllByText(/vs/).map((el) => el.textContent);
    expect(headings).toEqual(['Small Club vs Tiny Club', 'Big Club vs Huge Club']);

    await userEvent.click(screen.getByRole('button', { name: 'Importance' }));

    headings = await screen.findAllByText(/vs/).then((els) => els.map((el) => el.textContent));
    expect(headings).toEqual(['Big Club vs Huge Club', 'Small Club vs Tiny Club']);
  });

  it('shows an empty state when there are no matches for the sport', async () => {
    stubOddsEngineFetch([buildMatch({ sport: 'Football' })]);
    stubRankingsFetch();

    renderAt('/sports/Basketball');

    expect(await screen.findByText('No matches available right now.')).toBeInTheDocument();
  });
});
