import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
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

function stubFetch(
  matches: Match[],
  quicklinks: { competition: string; order: number }[] = [],
  rankings: { competition: string; rank: number }[] = [],
  quicklinkCounts: { boosts?: unknown[]; specials?: Match[]; leaderboardCampaigns?: unknown[]; promoCards?: unknown[] } = {},
) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url === '/backend/public/matches/brand-1') {
      return new Response(JSON.stringify(matches), { status: 200 });
    }
    if (url.startsWith('/backend/public/competition-quicklinks/')) {
      return new Response(JSON.stringify(quicklinks), { status: 200 });
    }
    if (url.startsWith('/backend/public/competition-rankings/')) {
      return new Response(JSON.stringify(rankings), { status: 200 });
    }
    if (url === '/backend/public/boosts/brand-1') {
      return new Response(JSON.stringify(quicklinkCounts.boosts ?? []), { status: 200 });
    }
    if (url === '/backend/public/specials/brand-1') {
      return new Response(JSON.stringify(quicklinkCounts.specials ?? []), { status: 200 });
    }
    if (url === '/backend/public/leaderboard-campaigns/brand-1') {
      return new Response(JSON.stringify(quicklinkCounts.leaderboardCampaigns ?? []), { status: 200 });
    }
    if (url === '/backend/public/promo-cards/brand-1') {
      return new Response(JSON.stringify(quicklinkCounts.promoCards ?? []), { status: 200 });
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

function LocationMarker() {
  const location = useLocation();
  return <p>Navigated to: {location.pathname}{location.search}</p>;
}

function renderSidebarWithBrowseRoute() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<Sidebar />} />
          <Route path="/browse" element={<LocationMarker />} />
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

describe('Sidebar', () => {
  it('shows a Top Competitions quicklinks block sorted by order, linking to the filtered sport page', async () => {
    stubFetch(
      [buildMatch(), buildMatch({ id: 'm2', country: 'Spain', competition: 'La Liga' })],
      [
        { competition: 'La Liga', order: 1 },
        { competition: 'Premier League', order: 0 },
      ],
    );

    renderSidebar();

    // Wait for the async quicklinks fetch to resolve (and the Boosts/
    // Specials shortcuts above it to have settled in) before reading link
    // order, rather than snapshotting on the very first render.
    await screen.findByRole('link', { name: /Premier League/ });
    const links = screen.getAllByRole('link');
    // Each link's textContent may be prefixed with a flag icon, so match on
    // suffix rather than exact equality.
    const quicklinkLabels = links.map((link) => link.textContent ?? '');
    expect(quicklinkLabels.findIndex((text) => text.endsWith('Premier League'))).toBeLessThan(
      quicklinkLabels.findIndex((text) => text.endsWith('La Liga')),
    );
    expect(screen.getByRole('link', { name: /Premier League/ })).toHaveAttribute(
      'href',
      '/sports/Football?competition=Premier%20League',
    );
  });

  it('omits the Top Competitions block entirely when no quicklinks are configured', async () => {
    stubFetch([buildMatch()], []);

    renderSidebar();

    await screen.findByText('Sports');
    expect(screen.queryByText('Top Competitions')).not.toBeInTheDocument();
  });

  it('shows a flag icon next to a quicklink when its country can be resolved from real match data', async () => {
    stubFetch(
      [buildMatch({ sport: 'Football', country: 'England', competition: 'Premier League' })],
      [{ competition: 'Premier League', order: 0 }],
    );

    renderSidebar();

    const link = await screen.findByRole('link', { name: /Premier League/ });
    expect(within(link).getByRole('img', { name: 'England' })).toBeInTheDocument();
  });

  it('shows a sport icon on each sport row and a flag icon on each expanded country row', async () => {
    stubFetch([
      buildMatch({ id: 'm1', sport: 'Football', country: 'England', competition: 'Premier League' }),
    ]);

    renderSidebar();

    expect(await screen.findByRole('img', { name: 'Football' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Football/ }));
    expect(await screen.findByRole('img', { name: 'England' })).toBeInTheDocument();
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

  it('expanding a sport shows an "All matches" link above the country list, pointing at the unfiltered sport page', async () => {
    stubFetch([
      buildMatch({ id: 'm1', sport: 'Football', country: 'England', competition: 'Premier League' }),
    ]);

    renderSidebar();

    await userEvent.click(await screen.findByRole('button', { name: /Football/ }));
    const allMatchesLink = screen.getByRole('link', { name: 'All matches' });
    expect(allMatchesLink).toHaveAttribute('href', '/sports/Football');

    const englandButton = screen.getByRole('button', { name: /England/ });
    // DOCUMENT_POSITION_FOLLOWING (4) means allMatchesLink comes first in the DOM.
    expect(allMatchesLink.compareDocumentPosition(englandButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

  it('shows matching matches directly when searching, hiding the tree and quicklinks (most searches want to bet, not browse leagues)', async () => {
    stubFetch(
      [
        buildMatch({
          id: 'm1',
          sport: 'Football',
          country: 'Spain',
          competition: 'La Liga',
          homeTeam: 'Real Madrid',
          awayTeam: 'Barcelona',
        }),
        buildMatch({ id: 'm2', sport: 'Ice Hockey', country: 'USA', competition: 'NHL' }),
      ],
      [{ competition: 'La Liga', order: 0 }],
    );

    renderSidebar();
    await screen.findByRole('button', { name: /Ice Hockey/ });

    await userEvent.type(
      screen.getByRole('searchbox', { name: 'Search sports and competitions' }),
      'Spain',
    );

    expect(await screen.findByRole('heading', { name: 'Matches' })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Real Madrid vs Barcelona/ }),
    ).toHaveAttribute('href', '/matches/m1');
    // The tree/quicklinks are hidden while direct match results are shown.
    expect(screen.queryByRole('heading', { name: 'Sports' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Top Competitions' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ice Hockey/ })).not.toBeInTheDocument();
  });

  it('drops a quicklinked competition from Top Competitions once it has no matches, sliding the next one into its place', async () => {
    stubFetch(
      [buildMatch({ id: 'm1', sport: 'Football', country: 'England', competition: 'Premier League' })],
      [
        { competition: 'Bundesliga', order: 0 },
        { competition: 'Premier League', order: 1 },
      ],
    );

    renderSidebar();

    expect(await screen.findByRole('link', { name: /Premier League/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Bundesliga/ })).not.toBeInTheDocument();
  });

  it('shows a "no matches found" message when the search query matches nothing', async () => {
    stubFetch([buildMatch({ sport: 'Football', country: 'England', competition: 'Premier League' })]);

    renderSidebar();
    await userEvent.type(
      await screen.findByRole('searchbox', { name: 'Search sports and competitions' }),
      'nonexistent sport',
    );

    expect(await screen.findByText(/No matches found for/)).toBeInTheDocument();
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

  describe('select multiple', () => {
    it('shows no Apply button and no checkboxes until "Select multiple" is toggled on', async () => {
      stubFetch([buildMatch({ sport: 'Football', country: 'England', competition: 'Premier League' })]);

      renderSidebar();

      await screen.findByRole('button', { name: /Football/ });
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Apply/ })).not.toBeInTheDocument();
    });

    it('selecting a sport checkbox does not also toggle that sport open/closed', async () => {
      stubFetch([buildMatch({ sport: 'Football', country: 'England', competition: 'Premier League' })]);

      renderSidebar();
      await userEvent.click(await screen.findByRole('button', { name: 'Select multiple' }));

      await userEvent.click(screen.getByRole('checkbox', { name: /Select Football/ }));

      expect(screen.queryByRole('button', { name: /England/ })).not.toBeInTheDocument();
    });

    it('selecting a sport and a competition, then applying, navigates to /browse with both encoded', async () => {
      stubFetch([
        buildMatch({ id: 'm1', sport: 'Football', country: 'England', competition: 'Premier League' }),
        buildMatch({ id: 'm2', sport: 'Basketball', country: 'USA', competition: 'NBA' }),
      ]);

      renderSidebarWithBrowseRoute();
      await userEvent.click(await screen.findByRole('button', { name: 'Select multiple' }));

      await userEvent.click(screen.getByRole('checkbox', { name: /Select Basketball/ }));

      await userEvent.click(screen.getByRole('button', { name: /Football/ }));
      await userEvent.click(screen.getByRole('button', { name: /England/ }));
      await userEvent.click(screen.getByRole('checkbox', { name: /Select Premier League/ }));

      await userEvent.click(screen.getByRole('button', { name: 'Apply (2)' }));

      const marker = await screen.findByText(/Navigated to:/);
      expect(marker.textContent).toBe('Navigated to: /browse?sports=Basketball&competitions=Premier+League');
    });

    it('"Cancel" exits select-multiple mode and clears any selections', async () => {
      stubFetch([buildMatch({ sport: 'Football', country: 'England', competition: 'Premier League' })]);

      renderSidebar();
      await userEvent.click(await screen.findByRole('button', { name: 'Select multiple' }));
      await userEvent.click(screen.getByRole('checkbox', { name: /Select Football/ }));

      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Select multiple' })).toBeInTheDocument();
    });
  });

  describe('quicklink counts', () => {
    it('shows no count badge on any quicklink when nothing is available', async () => {
      stubFetch([]);
      renderSidebar();

      await screen.findByRole('link', { name: /Boosts/ });
      expect(screen.getByRole('link', { name: 'Boosts' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Specials' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Leaderboards' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Challenges' })).toBeInTheDocument();
    });

    it('shows a count badge on each quicklink once its endpoint returns items', async () => {
      stubFetch([], [], [], {
        boosts: [{ matchId: 'm1' }, { matchId: 'm2' }],
        specials: [buildMatch({ id: 'special-1' })],
        leaderboardCampaigns: [{ id: 'lb-1' }, { id: 'lb-2' }, { id: 'lb-3' }],
        promoCards: [
          { id: 'card-1', status: 'ACTIVE' },
          { id: 'card-2', status: 'ACTIVE' },
          { id: 'card-3', status: 'EARLY_ENDED' },
        ],
      });
      renderSidebar();

      expect(await screen.findByRole('link', { name: /Boosts.*2/ })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Specials.*1/ })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Leaderboards.*3/ })).toBeInTheDocument();
      // Only the 2 ACTIVE cards count - the EARLY_ENDED one doesn't.
      expect(screen.getByRole('link', { name: /Challenges.*2/ })).toBeInTheDocument();
    });
  });
});
