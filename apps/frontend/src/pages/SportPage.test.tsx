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
    country: 'England',
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
          <Route path="/live" element={<SportPage />} />
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

    expect(await screen.findByRole('link', { name: 'Arsenal vs Chelsea' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Bruins vs Rangers' })).not.toBeInTheDocument();
  });

  it('shows every sport when the URL param is "all"', async () => {
    stubOddsEngineFetch([
      buildMatch({ id: 'm1', sport: 'Football', homeTeam: 'Arsenal', awayTeam: 'Chelsea' }),
      buildMatch({ id: 'm2', sport: 'Ice Hockey', homeTeam: 'Bruins', awayTeam: 'Rangers' }),
    ]);
    stubRankingsFetch();

    renderAt('/sports/all');

    expect(await screen.findByRole('link', { name: 'Arsenal vs Chelsea' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Bruins vs Rangers' })).toBeInTheDocument();
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
    await screen.findByRole('link', { name: 'Small Club vs Tiny Club' });

    // Default "Time" mode: minor match kicks off first.
    let headings = screen
      .getAllByRole('link', { name: /vs/ })
      .map((el) => el.getAttribute('aria-label'));
    expect(headings).toEqual(['Small Club vs Tiny Club', 'Big Club vs Huge Club']);

    await userEvent.click(screen.getByRole('button', { name: 'Importance' }));

    headings = await screen
      .findAllByRole('link', { name: /vs/ })
      .then((els) => els.map((el) => el.getAttribute('aria-label')));
    expect(headings).toEqual(['Big Club vs Huge Club', 'Small Club vs Tiny Club']);
  });

  it('filters further to a single competition when the URL carries a competition param, and uses it as the heading', async () => {
    stubOddsEngineFetch([
      buildMatch({
        id: 'm1',
        sport: 'Football',
        competition: 'Premier League',
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea',
      }),
      buildMatch({
        id: 'm2',
        sport: 'Football',
        competition: 'Championship',
        homeTeam: 'Leeds',
        awayTeam: 'Norwich',
      }),
    ]);
    stubRankingsFetch();

    renderAt('/sports/Football?competition=Premier%20League');

    expect(await screen.findByRole('link', { name: 'Arsenal vs Chelsea' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Leeds vs Norwich' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Premier League' })).toBeInTheDocument();
  });

  it('filters to only live matches when the URL carries live=true, and uses "Live" as the heading', async () => {
    stubOddsEngineFetch([
      buildMatch({ id: 'm1', isLive: true, homeTeam: 'Arsenal', awayTeam: 'Chelsea' }),
      buildMatch({ id: 'm2', isLive: false, homeTeam: 'Leeds', awayTeam: 'Norwich' }),
    ]);
    stubRankingsFetch();

    renderAt('/sports/all?live=true');

    expect(await screen.findByRole('link', { name: 'Arsenal vs Chelsea' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Leeds vs Norwich' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Live' })).toBeInTheDocument();
  });

  it('filters to only live matches when mounted at /live directly (bottom-nav Live link)', async () => {
    stubOddsEngineFetch([
      buildMatch({ id: 'm1', isLive: true, homeTeam: 'Arsenal', awayTeam: 'Chelsea' }),
      buildMatch({ id: 'm2', isLive: false, homeTeam: 'Leeds', awayTeam: 'Norwich' }),
    ]);
    stubRankingsFetch();

    renderAt('/live');

    expect(await screen.findByRole('link', { name: 'Arsenal vs Chelsea' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Leeds vs Norwich' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Live' })).toBeInTheDocument();
  });

  it('breadcrumb lets you switch country, then a league within that country', async () => {
    stubOddsEngineFetch([
      buildMatch({
        id: 'm1',
        sport: 'Football',
        country: 'England',
        competition: 'Premier League',
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea',
      }),
      buildMatch({
        id: 'm2',
        sport: 'Football',
        country: 'England',
        competition: 'Championship',
        homeTeam: 'Leeds',
        awayTeam: 'Norwich',
      }),
      buildMatch({
        id: 'm3',
        sport: 'Football',
        country: 'Spain',
        competition: 'La Liga',
        homeTeam: 'Real Madrid',
        awayTeam: 'Barcelona',
      }),
    ]);
    stubRankingsFetch();

    renderAt('/sports/Football?competition=Premier%20League');
    await screen.findByRole('link', { name: 'Arsenal vs Chelsea' });

    // Switch country from England to Spain via the breadcrumb.
    await userEvent.click(screen.getByRole('button', { name: 'England' }));
    await userEvent.click(screen.getByRole('option', { name: 'Spain' }));

    expect(await screen.findByRole('link', { name: 'Real Madrid vs Barcelona' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Championship' })).not.toBeInTheDocument();

    // Back in England, switch league from Premier League to Championship.
    await userEvent.click(screen.getByRole('button', { name: 'Spain' }));
    await userEvent.click(screen.getByRole('option', { name: 'England' }));
    await screen.findByRole('button', { name: 'All leagues' });

    await userEvent.click(screen.getByRole('button', { name: 'All leagues' }));
    await userEvent.click(screen.getByRole('option', { name: 'Championship' }));

    expect(await screen.findByRole('link', { name: 'Leeds vs Norwich' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Arsenal vs Chelsea' })).not.toBeInTheDocument();
  });

  it('does not render a breadcrumb country/competition dropdown for a sport with only one country and one competition', async () => {
    stubOddsEngineFetch([buildMatch({ sport: 'Football', country: 'England', competition: 'EPL' })]);
    stubRankingsFetch();

    renderAt('/sports/Football');
    await screen.findByRole('link', { name: 'Arsenal vs Chelsea' });

    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).not.toBeInTheDocument();
  });

  it('shows an empty state when there are no matches for the sport', async () => {
    stubOddsEngineFetch([buildMatch({ sport: 'Football' })]);
    stubRankingsFetch();

    renderAt('/sports/Basketball');

    expect(await screen.findByText('No matches available right now.')).toBeInTheDocument();
  });
});
