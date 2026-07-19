import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Match } from '@sportsbook/shared';
import { useBrandStore } from '../brand/brandStore';
import { Sidebar } from './Sidebar';

function buildMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'm1',
    sport: 'Football',
    country: 'England',
    competition: 'Premier League',
    homeTeam: 'Home',
    awayTeam: 'Away',
    kickoff: '2026-07-19T18:00:00Z',
    isLive: false,
    markets: [],
    ...overrides,
  };
}

function stubFetch(matches: Match[], rankings: { competition: string; rank: number }[] = []) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url === '/api/events') {
      return new Response(JSON.stringify(matches), { status: 200 });
    }
    if (url.startsWith('/backend/public/competition-rankings/')) {
      return new Response(JSON.stringify(rankings), { status: 200 });
    }
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderSidebar() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Sidebar />
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

describe('Sidebar', () => {
  it('shows a Top Competitions quicklinks block sorted by rank, linking to the filtered sport page', async () => {
    stubFetch([buildMatch()], [
      { competition: 'La Liga', rank: 1 },
      { competition: 'Premier League', rank: 0 },
    ]);

    renderSidebar();

    const links = await screen.findAllByRole('link');
    const quicklinkLabels = links.map((link) => link.textContent);
    expect(quicklinkLabels.indexOf('Premier League')).toBeLessThan(quicklinkLabels.indexOf('La Liga'));
    expect(screen.getByRole('link', { name: 'Premier League' })).toHaveAttribute(
      'href',
      '/sports/all?competition=Premier%20League',
    );
  });

  it('omits the Top Competitions block entirely when no rankings are configured', async () => {
    stubFetch([buildMatch()], []);

    renderSidebar();

    await screen.findByText('Sports');
    expect(screen.queryByText('Top Competitions')).not.toBeInTheDocument();
  });

  it('lists sports from real match data, collapsed by default', async () => {
    stubFetch([
      buildMatch({ id: 'm1', sport: 'Football' }),
      buildMatch({ id: 'm2', sport: 'Ice Hockey', country: 'USA', competition: 'NHL' }),
    ]);

    renderSidebar();

    expect(await screen.findByRole('button', { name: /Football/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ice Hockey/ })).toBeInTheDocument();
    expect(screen.queryByText('England')).not.toBeInTheDocument();
  });

  it('expands a sport to reveal countries, then a country to reveal competitions with a link to the filtered match list', async () => {
    stubFetch([
      buildMatch({ id: 'm1', sport: 'Football', country: 'England', competition: 'Premier League' }),
    ]);

    renderSidebar();

    await userEvent.click(await screen.findByRole('button', { name: /Football/ }));
    expect(screen.getByRole('button', { name: /England/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /England/ }));
    const competitionLink = screen.getByRole('link', { name: /Premier League/ });
    expect(competitionLink).toHaveAttribute(
      'href',
      '/sports/Football?competition=Premier%20League',
    );
  });

  it('collapses the previously expanded sport when a different one is opened', async () => {
    stubFetch([
      buildMatch({ id: 'm1', sport: 'Football', country: 'England' }),
      buildMatch({ id: 'm2', sport: 'Ice Hockey', country: 'USA', competition: 'NHL' }),
    ]);

    renderSidebar();

    await userEvent.click(await screen.findByRole('button', { name: /Football/ }));
    expect(screen.getByRole('button', { name: /England/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Ice Hockey/ }));
    expect(screen.queryByRole('button', { name: /England/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /USA/ })).toBeInTheDocument();
  });
});
