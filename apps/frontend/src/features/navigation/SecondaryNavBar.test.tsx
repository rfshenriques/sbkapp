import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Match } from '@sportsbook/shared';
import { useBrandStore } from '../brand/brandStore';
import { SecondaryNavBar } from './SecondaryNavBar';

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

function stubFetch(items: unknown[], matches: Match[] = []) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url === '/backend/public/top-nav/brand-1') {
      return new Response(JSON.stringify(items), { status: 200 });
    }
    if (url === '/backend/public/matches/brand-1') {
      return new Response(JSON.stringify(matches), { status: 200 });
    }
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderNav() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SecondaryNavBar />
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

describe('SecondaryNavBar', () => {
  it('renders nothing when no items are configured', async () => {
    stubFetch([]);
    const { container } = renderNav();

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container).toBeEmptyDOMElement();
  });

  it('links a SPORT item straight to its sport page', async () => {
    stubFetch([
      { id: '1', kind: 'SPORT', label: 'Football', icon: 'STAR', sport: 'Football', competition: null, matchId: null, sortOrder: 0 },
    ]);
    renderNav();

    expect(await screen.findByRole('link', { name: 'Football' })).toHaveAttribute(
      'href',
      '/sports/Football?from=quicklink',
    );
  });

  it('links a COMPETITION item to its resolved sport page when a live match reveals the sport', async () => {
    stubFetch(
      [
        {
          id: '1',
          kind: 'COMPETITION',
          label: 'Premier League', icon: 'STAR',
          sport: null,
          competition: 'Premier League',
          matchId: null,
          sortOrder: 0,
        },
      ],
      [buildMatch()],
    );
    renderNav();

    expect(await screen.findByRole('link', { name: 'Premier League' })).toHaveAttribute(
      'href',
      '/sports/Football?competition=Premier%20League&from=quicklink',
    );
  });

  it("shows a COMPETITION item's country flag instead of its sport icon - more identifying than a shared sport icon for telling e.g. Premier League apart from La Liga", async () => {
    stubFetch(
      [
        {
          id: '1',
          kind: 'COMPETITION',
          label: 'Premier League',
          icon: 'STAR',
          sport: null,
          competition: 'Premier League',
          matchId: null,
          sortOrder: 0,
        },
      ],
      [buildMatch()],
    );
    renderNav();

    const link = await screen.findByRole('link', { name: 'Premier League' });
    expect(link.querySelector('[role="img"][aria-label="England"]')).toBeInTheDocument();
  });

  it('falls back to the /sports/all umbrella for a COMPETITION item with no live match to resolve its sport', async () => {
    stubFetch([
      {
        id: '1',
        kind: 'COMPETITION',
        label: 'Off-season League', icon: 'STAR',
        sport: null,
        competition: 'Off-season League',
        matchId: null,
        sortOrder: 0,
      },
    ]);
    renderNav();

    expect(await screen.findByRole('link', { name: 'Off-season League' })).toHaveAttribute(
      'href',
      '/sports/all?competition=Off-season%20League&from=quicklink',
    );
  });

  it('links a MATCH item straight to the match detail page', async () => {
    stubFetch([
      { id: '1', kind: 'MATCH', label: 'Arsenal vs Chelsea', icon: 'STAR', sport: null, competition: null, matchId: 'm1', sortOrder: 0 },
    ]);
    renderNav();

    expect(await screen.findByRole('link', { name: 'Arsenal vs Chelsea' })).toHaveAttribute('href', '/matches/m1');
  });

  it('links TODAY and TOMORROW items to the all-sports view with the matching date filter', async () => {
    stubFetch([
      { id: '1', kind: 'TODAY', label: "Today's matches", icon: 'STAR', sport: null, competition: null, matchId: null, sortOrder: 0 },
      {
        id: '2',
        kind: 'TOMORROW',
        label: "Tomorrow's matches",
        icon: 'STAR',
        sport: null,
        competition: null,
        matchId: null,
        sortOrder: 1,
      },
    ]);
    renderNav();

    expect(await screen.findByRole('link', { name: "Today's matches" })).toHaveAttribute(
      'href',
      '/sports/all?date=today&from=quicklink',
    );
    expect(screen.getByRole('link', { name: "Tomorrow's matches" })).toHaveAttribute(
      'href',
      '/sports/all?date=tomorrow&from=quicklink',
    );
  });

  it('renders items in the server-provided order', async () => {
    stubFetch([
      { id: '1', kind: 'TODAY', label: "Today's matches", icon: 'STAR', sport: null, competition: null, matchId: null, sortOrder: 0 },
      { id: '2', kind: 'SPORT', label: 'Tennis', icon: 'CALENDAR', sport: 'Tennis', competition: null, matchId: null, sortOrder: 1 },
    ]);
    renderNav();

    const links = await screen.findAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(["Today's matches", 'Tennis']);
  });

  it("renders each item's label as visible text next to its icon, not just as a hover-only title a touch device never shows", async () => {
    stubFetch([
      { id: '1', kind: 'SPORT', label: 'Football', icon: 'TROPHY', sport: 'Football', competition: null, matchId: null, sortOrder: 0 },
    ]);
    renderNav();

    const link = await screen.findByRole('link', { name: 'Football' });
    expect(link).toHaveTextContent('Football');
    expect(link.querySelector('svg, img')).toBeInTheDocument();
  });

  it('uses the smaller .tab-sm pill size, not the regular .tab, so several quicklinks fit before running out of header width', async () => {
    stubFetch([
      { id: '1', kind: 'SPORT', label: 'Football', icon: 'TROPHY', sport: 'Football', competition: null, matchId: null, sortOrder: 0 },
    ]);
    renderNav();

    const link = await screen.findByRole('link', { name: 'Football' });
    expect(link).toHaveClass('tab', 'tab-sm');
  });

  it("shows a staff-set custom label instead of the item's default name", async () => {
    stubFetch([
      { id: '1', kind: 'SPORT', label: 'Footy', icon: 'TROPHY', sport: 'Football', competition: null, matchId: null, sortOrder: 0 },
    ]);
    renderNav();

    expect(await screen.findByRole('link', { name: 'Footy' })).toBeInTheDocument();
  });

  it("renders a SPORT item's own sport icon instead of its staff-picked generic icon", async () => {
    stubFetch([
      { id: '1', kind: 'SPORT', label: 'Football', icon: 'TROPHY', sport: 'Football', competition: null, matchId: null, sortOrder: 0 },
    ]);
    renderNav();

    const link = await screen.findByRole('link', { name: 'Football' });
    // Football has a real sport-icon image asset (see sportIconImages.ts) -
    // an <img>, not the generic TopNavIcon's inline <svg>.
    expect(link.querySelector('img')).toBeInTheDocument();
  });
});
