import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Match } from '@sportsbook/shared';
import { stubOddsEngineFetch, TEST_BRAND_ID } from '../test/mockOddsEngine';
import { mockMatches } from '../mocks/matches';
import { useBetSlipStore } from '../features/bet-slip/betSlipStore';
import { useBrandStore } from '../features/brand/brandStore';
import { fallbackTeamColor } from '../lib/fallbackTeamColor';
import OddsBoardPage from './OddsBoardPage';

function buildMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'm1',
    sport: 'Football',
    country: 'England',
    competition: 'EPL',
    homeTeam: 'Home',
    awayTeam: 'Away',
    kickoff: '2026-07-19T18:00:00Z',
    isLive: false,
    markets: [],
    ...overrides,
  };
}

/** jsdom serializes an inline `backgroundColor: '#RRGGBB'` style as `rgb(r, g, b)` - convert to match against it in attribute selectors. */
function hexToRgb(hex: string): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

/** 13 Football matches (earliest overall, so one becomes "Featured") + 2 Ice Hockey. */
function buildManySportsMatches(): Match[] {
  const football = Array.from({ length: 13 }, (_, index) =>
    buildMatch({
      id: `football-${index}`,
      sport: 'Football',
      homeTeam: `Football Home ${index}`,
      awayTeam: `Football Away ${index}`,
      kickoff: new Date(2026, 6, 19, 10 + index).toISOString(),
    }),
  );
  const hockey = Array.from({ length: 2 }, (_, index) =>
    buildMatch({
      id: `hockey-${index}`,
      sport: 'Ice Hockey',
      homeTeam: `Hockey Home ${index}`,
      awayTeam: `Hockey Away ${index}`,
      kickoff: new Date(2026, 6, 20, 10 + index).toISOString(),
    }),
  );
  return [...football, ...hockey];
}

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <OddsBoardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function renderPageWithRouting() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<OddsBoardPage />} />
          <Route path="/matches/:matchId" element={<p>Match detail page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  stubOddsEngineFetch();
  useBetSlipStore.setState({ selections: [] });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OddsBoardPage', () => {
  it('shows a loading skeleton before matches resolve, then renders the matches', async () => {
    renderPage();

    expect(screen.getByRole('status', { name: 'Loading matches' })).toBeInTheDocument();

    // The Upcoming list renders twice - a mobile copy and a desktop copy,
    // each CSS-hidden at the other breakpoint but both present in the DOM
    // (jsdom doesn't apply that CSS) - either copy is fine here.
    expect((await screen.findAllByRole('link', { name: 'Arsenal vs Chelsea' }))[0]).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Loading matches' })).not.toBeInTheDocument();
  });

  it('navigates to the featured match when clicking anywhere on its card', async () => {
    stubOddsEngineFetch(mockMatches, {}, ['match-3']);
    renderPageWithRouting();

    // match-3 (Real Madrid vs Barcelona) was explicitly configured as
    // Match of the day above - see task #11, it's never auto-picked. The
    // featured card renders twice - a mobile copy and a desktop copy, each
    // CSS-hidden at the other breakpoint but both present in the DOM
    // (jsdom doesn't apply that CSS) - either copy behaves identically, so
    // this just picks the first.
    const headings = await screen.findAllByRole('heading', { name: 'Real Madrid vs Barcelona' });
    await userEvent.click(headings[0] as HTMLElement);

    expect(await screen.findByText('Match detail page')).toBeInTheDocument();
  });

  it('does not navigate when picking an odd on the featured card', async () => {
    stubOddsEngineFetch(mockMatches, {}, ['match-3']);
    renderPageWithRouting();

    await screen.findAllByRole('heading', { name: 'Real Madrid vs Barcelona' });
    const oddsButtons = screen.getAllByRole('button', { name: /Real Madrid/ });
    await userEvent.click(oddsButtons[0] as HTMLElement);

    expect(screen.queryByText('Match detail page')).not.toBeInTheDocument();
    expect(useBetSlipStore.getState().selections).toHaveLength(1);
  });

  it('shows a colored edge marker on the featured card for every team - the backoffice color when assigned, a deterministic fallback otherwise', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === `/backend/public/matches/${TEST_BRAND_ID}`) {
        return new Response(JSON.stringify(mockMatches), { status: 200 });
      }
      if (url === `/backend/public/match-of-the-day/${TEST_BRAND_ID}`) {
        return new Response(JSON.stringify([{ id: 'motd-1', matchId: 'match-3', sortOrder: 0 }]), { status: 200 });
      }
      if (url === '/backend/public/team-colors') {
        return new Response(JSON.stringify([{ name: 'Real Madrid', colorHex: '#FEBE10' }]), {
          status: 200,
        });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    // The featured card's <h1> wraps both team badges directly - scoping to
    // it (rather than the whole page) avoids counting some other match's
    // marker that happens to land on the same fallback color by chance.
    const headings = await screen.findAllByRole('heading', { name: 'Real Madrid vs Barcelona' });
    // jsdom serializes inline colors as rgb(), not the hex they were set
    // with - match on that instead of the literal hex string.
    const realMadridRgb = hexToRgb('#FEBE10');
    const barcelonaRgb = hexToRgb(fallbackTeamColor('Barcelona'));
    // Every marker renders immediately with a fallback color even before
    // the team-colors fetch resolves, so wait for Real Madrid's real
    // assigned color specifically rather than just "some marker exists".
    await waitFor(() => {
      for (const heading of headings) {
        expect(heading.querySelector(`[aria-hidden="true"][style*="${realMadridRgb}"]`)).toBeInTheDocument();
      }
    });
    // One marker per team per featured-card copy (mobile + desktop): Real
    // Madrid's real assigned color, Barcelona's deterministic fallback (not
    // left uncolored).
    for (const heading of headings) {
      expect(heading.querySelectorAll(`[aria-hidden="true"][style*="${realMadridRgb}"]`)).toHaveLength(1);
      expect(heading.querySelectorAll(`[aria-hidden="true"][style*="${barcelonaRgb}"]`)).toHaveLength(1);
    }
  });

  it('shows the backoffice-assigned acronym on a team badge, falling back to derived initials for a team with none set', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === `/backend/public/matches/${TEST_BRAND_ID}`) {
        return new Response(JSON.stringify(mockMatches), { status: 200 });
      }
      if (url === `/backend/public/match-of-the-day/${TEST_BRAND_ID}`) {
        return new Response(JSON.stringify([{ id: 'motd-1', matchId: 'match-3', sortOrder: 0 }]), { status: 200 });
      }
      if (url === '/backend/public/team-colors') {
        return new Response(
          JSON.stringify([{ name: 'Real Madrid', colorHex: null, acronym: 'RMA' }]),
          { status: 200 },
        );
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    const headings = await screen.findAllByRole('heading', { name: 'Real Madrid vs Barcelona' });
    await waitFor(() => {
      for (const heading of headings) {
        expect(within(heading).getAllByText('RMA').length).toBeGreaterThan(0);
      }
    });
    // Barcelona has no assigned acronym - falls back to a 3-letter derived
    // initial ("Barcelona" is one word -> its first 3 letters) rather than
    // showing nothing.
    for (const heading of headings) {
      expect(within(heading).getAllByText('BAR').length).toBeGreaterThan(0);
    }
  });

  it('shows no Match of the day section at all when the brand has none configured, rather than auto-picking one', async () => {
    stubOddsEngineFetch(mockMatches, {}, []);
    renderPage();

    await screen.findAllByRole('link', { name: 'Arsenal vs Chelsea' });
    expect(screen.queryByRole('group', { name: 'Featured content' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /vs/ })).not.toBeInTheDocument();
  });

  it('features exactly the staff-picked match, even when it is not the earliest kickoff', async () => {
    // match-2 (Liverpool vs Manchester City) kicks off after match-1
    // (Arsenal vs Chelsea) and the live match-3 - it only becomes featured
    // because it was explicitly configured, never because of its kickoff.
    stubOddsEngineFetch(mockMatches, {}, ['match-2']);
    renderPage();

    expect(await screen.findAllByRole('heading', { name: 'Liverpool vs Manchester City' })).toHaveLength(1);
    // Every other match, including the earlier ones, stays in the plain
    // Upcoming/Live lists rather than also being pulled out as "featured".
    expect((await screen.findAllByRole('link', { name: 'Arsenal vs Chelsea' }))[0]).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Arsenal vs Chelsea' })).not.toBeInTheDocument();
  });

  it('cycles through multiple Match of the day picks one at a time, in the same shared carousel promo cards also share', async () => {
    stubOddsEngineFetch(mockMatches, {}, ['match-1', 'match-2']);
    renderPage();

    const scroller = await screen.findByRole('group', { name: 'Featured content' });
    expect(within(scroller).getAllByRole('heading', { name: /vs/ })).toHaveLength(2);
  });

  it('silently drops a Match of the day pick whose match has no match-result market, without erroring or removing it from Upcoming', async () => {
    const noOddsYet = buildMatch({
      id: 'no-odds-yet',
      homeTeam: 'No Odds Home',
      awayTeam: 'No Odds Away',
      kickoff: '2026-07-19T08:00:00Z',
      markets: [{ id: 'anytime-assist', name: 'Anytime Assist', selections: [{ id: 'yes', name: 'Yes', odds: 2.1 }] }],
    });
    stubOddsEngineFetch([noOddsYet], {}, ['no-odds-yet']);

    renderPage();

    expect((await screen.findAllByRole('link', { name: 'No Odds Home vs No Odds Away' }))[0]).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Featured content' })).not.toBeInTheDocument();
  });

  it('silently drops a Match of the day pick whose match has since disappeared from the live feed', async () => {
    stubOddsEngineFetch(mockMatches, {}, ['match-that-no-longer-exists']);
    renderPage();

    await screen.findAllByRole('link', { name: 'Arsenal vs Chelsea' });
    expect(screen.queryByRole('group', { name: 'Featured content' })).not.toBeInTheDocument();
  });

  it('caps the Upcoming list at 10 and grows it in place, without navigating, when Load more is clicked', async () => {
    stubOddsEngineFetch(buildManySportsMatches());
    renderPage();

    await screen.findAllByRole('link', { name: 'Football Home 1 vs Football Away 1' });
    // 13 football matches - capped to 10 visible here, doubled to 20 across
    // the mobile+desktop copies.
    expect(screen.getAllByRole('link', { name: /Football Home \d+ vs Football Away \d+/ })).toHaveLength(
      20,
    );

    const loadMoreButtons = screen.getAllByRole('button', { name: 'Load more' });
    expect(screen.queryByRole('link', { name: 'Load more' })).not.toBeInTheDocument();
    for (const button of loadMoreButtons) {
      await userEvent.click(button);
    }

    // All 13 football matches are now visible, still on the homepage (same
    // MemoryRouter location, no navigation to /sports/*).
    expect(screen.getAllByRole('link', { name: /Football Home \d+ vs Football Away \d+/ })).toHaveLength(
      26,
    );
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('always leads chips with Football, Tennis, Basketball in that order when present', async () => {
    // Deliberately seeded out of priority order and out of kickoff order,
    // so the assertion can't pass by accident of either. An extra earliest
    // match (duplicate sport) is taken as "Featured" without emptying any
    // of the five sports out of the Upcoming list.
    stubOddsEngineFetch([
      buildMatch({ id: 'm0', sport: 'Football', kickoff: '2026-07-19T08:00:00Z' }),
      buildMatch({ id: 'm1', sport: 'Boxing', kickoff: '2026-07-19T09:00:00Z' }),
      buildMatch({ id: 'm2', sport: 'Basketball', kickoff: '2026-07-19T10:00:00Z' }),
      buildMatch({ id: 'm3', sport: 'Ice Hockey', kickoff: '2026-07-19T11:00:00Z' }),
      buildMatch({ id: 'm4', sport: 'Tennis', kickoff: '2026-07-19T12:00:00Z' }),
      buildMatch({ id: 'm5', sport: 'Football', kickoff: '2026-07-19T13:00:00Z' }),
    ]);
    renderPage();

    // The chip row renders twice (mobile + desktop copies, see the
    // loading-skeleton test) - scope to just the first one.
    const groups = await screen.findAllByRole('group', { name: 'Filter by sport' });
    const knownSports = ['Boxing', 'Basketball', 'Ice Hockey', 'Tennis', 'Football'];
    // Each chip's textContent is now "<icon emoji><sport name>" - match on
    // suffix rather than exact equality so the icon doesn't break this.
    const chipLabels = within(groups[0]!)
      .getAllByRole('button')
      .map((button) => knownSports.find((sport) => (button.textContent ?? '').endsWith(sport)))
      .filter((sport): sport is string => sport !== undefined);

    expect(chipLabels).toEqual(['Football', 'Tennis', 'Basketball', 'Boxing', 'Ice Hockey']);
  });

  it('filters the Upcoming list by sport via the chip row', async () => {
    stubOddsEngineFetch(buildManySportsMatches());
    renderPage();

    await screen.findAllByRole('link', { name: 'Football Home 1 vs Football Away 1' });
    expect(screen.queryAllByRole('link', { name: 'Hockey Home 0 vs Hockey Away 0' })).toHaveLength(0);

    // Two chip instances (mobile + desktop copies) share the same selected-
    // sport state, so clicking either one updates both.
    const iceHockeyChips = screen.getAllByRole('button', { name: /Ice Hockey/ });
    await userEvent.click(iceHockeyChips[0]!);

    expect(await screen.findAllByRole('link', { name: 'Hockey Home 0 vs Hockey Away 0' })).not.toHaveLength(0);
    expect(screen.queryAllByRole('link', { name: /Football Home/ })).toHaveLength(0);
  });

  it('keeps the kickoff time filter collapsed behind a clock icon until clicked, defaulting to All', async () => {
    stubOddsEngineFetch(buildManySportsMatches());
    renderPage();

    await screen.findAllByRole('link', { name: 'Football Home 1 vs Football Away 1' });

    expect(screen.queryByRole('group', { name: 'Filter by kickoff time' })).not.toBeInTheDocument();
    const toggles = screen.getAllByRole('button', { name: 'Filter by kickoff time' });
    expect(toggles.length).toBeGreaterThan(0);
    toggles.forEach((toggle) => expect(toggle).toHaveAttribute('aria-expanded', 'false'));

    await userEvent.click(toggles[0]!);

    const menus = screen.getAllByRole('group', { name: 'Filter by kickoff time' });
    expect(menus.length).toBeGreaterThan(0);
    expect(within(menus[0]!).getByRole('button', { name: /All/ })).toHaveClass('active');
  });

  it('only offers kickoff-time windows that actually have a match in them', async () => {
    // 30h out clears the 3h and 24h windows but still lands inside 48h/All -
    // real Date.now(), not a fixture date, so this holds regardless of when the suite runs.
    const kickoff = new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString();
    stubOddsEngineFetch([buildMatch({ kickoff })]);
    renderPage();

    const toggles = await screen.findAllByRole('button', { name: 'Filter by kickoff time' });
    await userEvent.click(toggles[0]!);

    const menu = screen.getAllByRole('group', { name: 'Filter by kickoff time' })[0]!;
    expect(within(menu).queryByRole('button', { name: /3h/ })).not.toBeInTheDocument();
    expect(within(menu).queryByRole('button', { name: /24h/ })).not.toBeInTheDocument();
    expect(within(menu).getByRole('button', { name: /48h/ })).toBeInTheDocument();
    expect(within(menu).getByRole('button', { name: /All/ })).toBeInTheDocument();
  });

  it('renders the kickoff-time toggle as a circular icon button, not a text tab', async () => {
    stubOddsEngineFetch(buildManySportsMatches());
    renderPage();

    const toggles = await screen.findAllByRole('button', { name: 'Filter by kickoff time' });
    expect(toggles[0]).toHaveClass('icon-toggle');
    expect(toggles[0]).not.toHaveClass('tab');
  });

  it('renders CMS promo cards in the same shared carousel as Match of the day', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === `/backend/public/matches/${TEST_BRAND_ID}`) {
        return new Response(JSON.stringify(mockMatches), { status: 200 });
      }
      if (url === `/backend/public/promo-cards/${TEST_BRAND_ID}`) {
        return new Response(
          JSON.stringify([
            {
              id: 'card-1',
              mimeType: 'image/png',
              title: 'Champions League Promo',
              subtitle: null,
              sortOrder: 0,
              betAndGetCampaignId: 'campaign-1',
              depositCampaignId: null,
              hasImage: true,
              status: 'ACTIVE',
            },
          ]),
          { status: 200 },
        );
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    useBrandStore.setState({ brandId: TEST_BRAND_ID });

    renderPage();

    // The "Featured content" carousel is shared by Match of the day and
    // promo cards alike - it should carry the real card, not a whole new
    // section.
    const featuredSlot = await screen.findByRole('group', { name: 'Featured content' });
    expect(within(featuredSlot).getByText('Champions League Promo')).toBeInTheDocument();
    expect(within(featuredSlot).getByRole('link', { name: /Champions League Promo/ })).toHaveAttribute(
      'href',
      '/campaigns/campaign-1',
    );
  });

  it('omits promo cards from the carousel entirely when the brand has none active, rather than showing fabricated placeholder copy', async () => {
    stubOddsEngineFetch(mockMatches, {}, ['match-3']);
    renderPage();

    const featuredSlot = await screen.findByRole('group', { name: 'Featured content' });
    expect(within(featuredSlot).getAllByRole('heading', { name: /vs/ })).toHaveLength(1);
    expect(screen.queryByText('Welcome Bonus')).not.toBeInTheDocument();
    expect(screen.queryByText(/bonus bets/i)).not.toBeInTheDocument();
  });
});
