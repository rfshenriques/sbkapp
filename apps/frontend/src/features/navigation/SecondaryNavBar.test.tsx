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

/**
 * boosts/specials/leaderboard-campaigns default to an empty (not pending)
 * result unless a test overrides them - most tests here aren't exercising
 * those item kinds, and hasContent shows a BOOSTS/SPECIALS/LEADERBOARD item
 * optimistically while its query is still pending, so leaving those
 * endpoints unstubbed (404 -> permanently-pending isError state) would
 * quietly mask a real regression instead of the tests being explicit about
 * what's available.
 */
function stubFetch(
  items: unknown[],
  matches: Match[] = [],
  options: { boosts?: unknown[]; specials?: unknown[]; leaderboardCampaigns?: { id: string }[] } = {},
) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url === '/backend/public/top-nav/brand-1') {
      return new Response(JSON.stringify(items), { status: 200 });
    }
    if (url === '/backend/public/matches/brand-1') {
      return new Response(JSON.stringify(matches), { status: 200 });
    }
    if (url === '/backend/public/boosts/brand-1') {
      return new Response(JSON.stringify(options.boosts ?? []), { status: 200 });
    }
    if (url === '/backend/public/specials/brand-1') {
      return new Response(JSON.stringify(options.specials ?? []), { status: 200 });
    }
    if (url === '/backend/public/leaderboard-campaigns/brand-1') {
      return new Response(JSON.stringify(options.leaderboardCampaigns ?? []), { status: 200 });
    }
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** A match kicking off later today, real-clock-relative - matchDateBucket buckets off the actual current time, not a fixed fixture date. */
function todayMatch(overrides: Partial<Match> = {}): Match {
  return buildMatch({ kickoff: new Date(Date.now() + 60 * 60_000).toISOString(), ...overrides });
}

/** A match kicking off tomorrow, real-clock-relative - see todayMatch. */
function tomorrowMatch(overrides: Partial<Match> = {}): Match {
  return buildMatch({ kickoff: new Date(Date.now() + 26 * 60 * 60_000).toISOString(), ...overrides });
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
    stubFetch(
      [
        { id: '1', kind: 'SPORT', label: 'Football', icon: 'STAR', sport: 'Football', competition: null, matchId: null, sortOrder: 0 },
      ],
      [buildMatch({ sport: 'Football' })],
    );
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

  it('links a MATCH item straight to the match detail page', async () => {
    stubFetch(
      [
        { id: '1', kind: 'MATCH', label: 'Arsenal vs Chelsea', icon: 'STAR', sport: null, competition: null, matchId: 'm1', sortOrder: 0 },
      ],
      [buildMatch({ id: 'm1' })],
    );
    renderNav();

    expect(await screen.findByRole('link', { name: 'Arsenal vs Chelsea' })).toHaveAttribute('href', '/matches/m1');
  });

  it('links TODAY and TOMORROW items to the all-sports view with the matching date filter', async () => {
    stubFetch(
      [
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
      ],
      [todayMatch({ id: 'today-1' }), tomorrowMatch({ id: 'tomorrow-1' })],
    );
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
    stubFetch(
      [
        { id: '1', kind: 'TODAY', label: "Today's matches", icon: 'STAR', sport: null, competition: null, matchId: null, sortOrder: 0 },
        { id: '2', kind: 'SPORT', label: 'Tennis', icon: 'CALENDAR', sport: 'Tennis', competition: null, matchId: null, sortOrder: 1 },
      ],
      [todayMatch({ id: 'today-1' }), buildMatch({ id: 'tennis-1', sport: 'Tennis' })],
    );
    renderNav();

    const links = await screen.findAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(["Today's matches", 'Tennis']);
  });

  it("renders each item's label as visible text next to its icon, not just as a hover-only title a touch device never shows", async () => {
    stubFetch(
      [
        { id: '1', kind: 'SPORT', label: 'Football', icon: 'TROPHY', sport: 'Football', competition: null, matchId: null, sortOrder: 0 },
      ],
      [buildMatch({ sport: 'Football' })],
    );
    renderNav();

    const link = await screen.findByRole('link', { name: 'Football' });
    expect(link).toHaveTextContent('Football');
    expect(link.querySelector('svg, img')).toBeInTheDocument();
  });

  it('uses the smaller .tab-sm pill size, not the regular .tab, so several quicklinks fit before running out of header width', async () => {
    stubFetch(
      [
        { id: '1', kind: 'SPORT', label: 'Football', icon: 'TROPHY', sport: 'Football', competition: null, matchId: null, sortOrder: 0 },
      ],
      [buildMatch({ sport: 'Football' })],
    );
    renderNav();

    const link = await screen.findByRole('link', { name: 'Football' });
    expect(link).toHaveClass('tab', 'tab-sm');
  });

  it("shows a staff-set custom label instead of the item's default name", async () => {
    stubFetch(
      [
        { id: '1', kind: 'SPORT', label: 'Footy', icon: 'TROPHY', sport: 'Football', competition: null, matchId: null, sortOrder: 0 },
      ],
      [buildMatch({ sport: 'Football' })],
    );
    renderNav();

    expect(await screen.findByRole('link', { name: 'Footy' })).toBeInTheDocument();
  });

  it("renders a SPORT item's own sport icon instead of its staff-picked generic icon", async () => {
    stubFetch(
      [
        { id: '1', kind: 'SPORT', label: 'Football', icon: 'TROPHY', sport: 'Football', competition: null, matchId: null, sortOrder: 0 },
      ],
      [buildMatch({ sport: 'Football' })],
    );
    renderNav();

    const link = await screen.findByRole('link', { name: 'Football' });
    // Football has a real sport-icon image asset (see sportIconImages.ts) -
    // an <img>, not the generic TopNavIcon's inline <svg>.
    expect(link.querySelector('img')).toBeInTheDocument();
  });

  describe('hiding a quicklink with nothing behind it', () => {
    it('hides a COMPETITION item once there are no matches for it', async () => {
      stubFetch(
        [
          {
            id: '1',
            kind: 'COMPETITION',
            label: 'Off-season League',
            icon: 'STAR',
            sport: null,
            competition: 'Off-season League',
            matchId: null,
            sortOrder: 0,
          },
        ],
        [buildMatch({ competition: 'Premier League' })],
      );
      const { container } = renderNav();

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(container).toBeEmptyDOMElement();
    });

    it('hides a SPORT item once there are no matches for that sport', async () => {
      stubFetch(
        [{ id: '1', kind: 'SPORT', label: 'Tennis', icon: 'STAR', sport: 'Tennis', competition: null, matchId: null, sortOrder: 0 }],
        [buildMatch({ sport: 'Football' })],
      );
      const { container } = renderNav();

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(container).toBeEmptyDOMElement();
    });

    it('hides a MATCH item once that match is no longer in the feed', async () => {
      stubFetch(
        [{ id: '1', kind: 'MATCH', label: 'Arsenal vs Chelsea', icon: 'STAR', sport: null, competition: null, matchId: 'm1', sortOrder: 0 }],
        [],
      );
      const { container } = renderNav();

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(container).toBeEmptyDOMElement();
    });

    it('hides TODAY when nothing kicks off today, keeping TOMORROW visible', async () => {
      stubFetch(
        [
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
        ],
        [tomorrowMatch()],
      );
      renderNav();

      expect(await screen.findByRole('link', { name: "Tomorrow's matches" })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: "Today's matches" })).not.toBeInTheDocument();
    });

    it('hides a BOOSTS item once loaded with no active boosts, and a SPECIALS item with no active specials', async () => {
      stubFetch(
        [
          { id: '1', kind: 'BOOSTS', label: 'Boosts', icon: 'STAR', sport: null, competition: null, matchId: null, sortOrder: 0 },
          { id: '2', kind: 'SPECIALS', label: 'Specials', icon: 'STAR', sport: null, competition: null, matchId: null, sortOrder: 1 },
        ],
        [],
        { boosts: [], specials: [] },
      );
      const { container } = renderNav();

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(container).toBeEmptyDOMElement();
    });

    it('keeps a BOOSTS item visible once loaded with an active boost', async () => {
      stubFetch(
        [{ id: '1', kind: 'BOOSTS', label: 'Boosts', icon: 'STAR', sport: null, competition: null, matchId: null, sortOrder: 0 }],
        [],
        { boosts: [{ id: 'boost-1' }] },
      );
      renderNav();

      expect(await screen.findByRole('link', { name: 'Boosts' })).toHaveAttribute('href', '/boosts');
    });

    it('hides a LEADERBOARD item once its specific campaign is no longer active', async () => {
      stubFetch(
        [
          {
            id: '1',
            kind: 'LEADERBOARD',
            label: 'Top Scorers',
            icon: 'STAR',
            sport: null,
            competition: null,
            matchId: null,
            leaderboardCampaignId: 'lb-1',
            sortOrder: 0,
          },
        ],
        [],
        { leaderboardCampaigns: [{ id: 'lb-2' }] },
      );
      const { container } = renderNav();

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(container).toBeEmptyDOMElement();
    });

    it('shows an item optimistically while its availability data is still loading, rather than flashing it away', async () => {
      // No matches response ever resolves (a permanently-pending fetch) -
      // the item must still render immediately rather than waiting on it.
      const fetchMock = vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url === '/backend/public/top-nav/brand-1') {
          return Promise.resolve(
            new Response(
              JSON.stringify([
                { id: '1', kind: 'SPORT', label: 'Football', icon: 'STAR', sport: 'Football', competition: null, matchId: null, sortOrder: 0 },
              ]),
              { status: 200 },
            ),
          );
        }
        return new Promise<Response>(() => {});
      });
      vi.stubGlobal('fetch', fetchMock);

      renderNav();

      expect(await screen.findByRole('link', { name: 'Football' })).toBeInTheDocument();
    });
  });
});
