import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Match } from '@sportsbook/shared';
import { useBrandStore } from '../features/brand/brandStore';
import BrowsePage from './BrowsePage';

const TEST_BRAND_ID = 'brand-1';

function buildMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'm1',
    sport: 'Football',
    country: 'England',
    competition: 'Premier League',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    kickoff: '2026-07-19T18:00:00Z',
    isLive: false,
    markets: [],
    ...overrides,
  };
}

function stubFetch(matches: Match[]) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url === `/backend/public/matches/${TEST_BRAND_ID}`) {
      return new Response(JSON.stringify(matches), { status: 200 });
    }
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderBrowsePage(search: string) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/browse${search}`]}>
        <BrowsePage />
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

describe('BrowsePage', () => {
  it('shows only matches from a selected sport', async () => {
    stubFetch([
      buildMatch({ id: 'm1', sport: 'Football' }),
      buildMatch({ id: 'm2', sport: 'Basketball', competition: 'NBA', homeTeam: 'Lakers', awayTeam: 'Celtics' }),
    ]);

    renderBrowsePage('?sports=Football');

    expect(await screen.findByText(/Arsenal/)).toBeInTheDocument();
    expect(screen.queryByText(/Lakers/)).not.toBeInTheDocument();
  });

  it('shows only matches from a selected competition, even in an unselected sport', async () => {
    stubFetch([
      buildMatch({ id: 'm1', sport: 'Football', competition: 'Premier League' }),
      buildMatch({ id: 'm2', sport: 'Football', competition: 'Championship', homeTeam: 'Leeds', awayTeam: 'Norwich' }),
    ]);

    renderBrowsePage('?competitions=Championship');

    expect(await screen.findByText(/Leeds/)).toBeInTheDocument();
    expect(screen.queryByText(/Arsenal/)).not.toBeInTheDocument();
  });

  it('combines a selected sport and a selected competition from a different sport', async () => {
    stubFetch([
      buildMatch({ id: 'm1', sport: 'Football', competition: 'Premier League' }),
      buildMatch({ id: 'm2', sport: 'Basketball', competition: 'NBA', homeTeam: 'Lakers', awayTeam: 'Celtics' }),
      buildMatch({ id: 'm3', sport: 'Tennis', competition: 'ATP', homeTeam: 'Alcaraz', awayTeam: 'Sinner' }),
    ]);

    renderBrowsePage('?sports=Football&competitions=NBA');

    expect(await screen.findByText(/Arsenal/)).toBeInTheDocument();
    expect(screen.getByText(/Lakers/)).toBeInTheDocument();
    expect(screen.queryByText(/Alcaraz/)).not.toBeInTheDocument();
  });

  it('shows an honest empty state rather than every match when nothing qualifies', async () => {
    stubFetch([buildMatch({ id: 'm1', sport: 'Football' })]);

    renderBrowsePage('?sports=Basketball');

    expect(await screen.findByText('No matches available for this selection right now.')).toBeInTheDocument();
    expect(screen.queryByText(/Arsenal/)).not.toBeInTheDocument();
  });
});
