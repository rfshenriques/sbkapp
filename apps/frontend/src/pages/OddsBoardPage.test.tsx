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

    expect(await screen.findByRole('link', { name: 'Arsenal vs Chelsea' })).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Loading matches' })).not.toBeInTheDocument();
  });

  it('navigates to the featured match when clicking anywhere on its card', async () => {
    renderPageWithRouting();

    // mockMatches' only live fixture (Real Madrid vs Barcelona) sorts first.
    // The featured card renders twice - a mobile copy and a desktop copy,
    // each CSS-hidden at the other breakpoint but both present in the DOM
    // (jsdom doesn't apply that CSS) - either copy behaves identically, so
    // this just picks the first.
    const headings = await screen.findAllByRole('heading', { name: 'Real Madrid vs Barcelona' });
    await userEvent.click(headings[0] as HTMLElement);

    expect(await screen.findByText('Match detail page')).toBeInTheDocument();
  });

  it('does not navigate when picking an odd on the featured card', async () => {
    renderPageWithRouting();

    await screen.findAllByRole('heading', { name: 'Real Madrid vs Barcelona' });
    const oddsButtons = screen.getAllByRole('button', { name: /Home/ });
    await userEvent.click(oddsButtons[0] as HTMLElement);

    expect(screen.queryByText('Match detail page')).not.toBeInTheDocument();
    expect(useBetSlipStore.getState().selections).toHaveLength(1);
  });

  it('shows a colored edge marker on the featured card only for teams with a backoffice-assigned color', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === `/backend/public/matches/${TEST_BRAND_ID}`) {
        return new Response(JSON.stringify(mockMatches), { status: 200 });
      }
      if (url === '/backend/public/team-colors') {
        return new Response(JSON.stringify([{ name: 'Real Madrid', colorHex: '#FEBE10' }]), {
          status: 200,
        });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { container } = renderPage();

    await screen.findAllByRole('heading', { name: 'Real Madrid vs Barcelona' });
    const markers = await waitFor(() => {
      const found = container.querySelectorAll('[aria-hidden="true"][style*="background-color"]');
      expect(found.length).toBeGreaterThan(0);
      return found;
    });
    // One marker per featured-card copy (mobile + desktop - see the comment
    // in the test above).
    expect(markers).toHaveLength(2);
    expect(markers[0]).toHaveStyle({ backgroundColor: '#FEBE10' });
    expect(markers[1]).toHaveStyle({ backgroundColor: '#FEBE10' });
  });

  it('features the next-earliest match with a match-result market, without dropping the earliest one that lacks it', async () => {
    const noOddsYet = buildMatch({
      id: 'no-odds-yet',
      homeTeam: 'No Odds Home',
      awayTeam: 'No Odds Away',
      kickoff: '2026-07-19T08:00:00Z',
      markets: [{ id: 'anytime-assist', name: 'Anytime Assist', selections: [{ id: 'yes', name: 'Yes', odds: 2.1 }] }],
    });
    const hasOdds = buildMatch({
      id: 'has-odds',
      homeTeam: 'Has Odds Home',
      awayTeam: 'Has Odds Away',
      kickoff: '2026-07-19T09:00:00Z',
      markets: [
        {
          id: 'match-result',
          name: 'Match Result',
          selections: [
            { id: 'home', name: 'Home', odds: 1.9 },
            { id: 'away', name: 'Away', odds: 3.5 },
          ],
        },
      ],
    });
    stubOddsEngineFetch([noOddsYet, hasOdds]);

    renderPage();

    // The earlier-kickoff match without a match-result market never becomes
    // "featured" (see FeaturedMatchCard's odds requirement) - it must still
    // show up in the plain Upcoming list rather than vanishing entirely.
    expect(await screen.findByRole('link', { name: 'No Odds Home vs No Odds Away' })).toBeInTheDocument();
    // The next match, which does have odds, becomes the featured card.
    expect(await screen.findAllByRole('heading', { name: 'Has Odds Home vs Has Odds Away' })).toHaveLength(2);
  });

  it('caps the Upcoming list at 10 and shows a Load more link to the sport page', async () => {
    stubOddsEngineFetch(buildManySportsMatches());
    renderPage();

    await screen.findByRole('link', { name: 'Football Home 1 vs Football Away 1' });
    // 13 football matches, minus 1 taken as "Featured", leaves 12 - capped to 10 visible here.
    expect(screen.getAllByRole('link', { name: /Football Home \d+ vs Football Away \d+/ })).toHaveLength(
      10,
    );

    const loadMore = screen.getByRole('link', { name: 'Load more' });
    expect(loadMore).toHaveAttribute('href', '/sports/Football');
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

    await screen.findByRole('group', { name: 'Filter by sport' });
    const knownSports = ['Boxing', 'Basketball', 'Ice Hockey', 'Tennis', 'Football'];
    // Each chip's textContent is now "<icon emoji><sport name>" - match on
    // suffix rather than exact equality so the icon doesn't break this.
    const chipLabels = screen
      .getAllByRole('button')
      .map((button) => knownSports.find((sport) => (button.textContent ?? '').endsWith(sport)))
      .filter((sport): sport is string => sport !== undefined);

    expect(chipLabels).toEqual(['Football', 'Tennis', 'Basketball', 'Boxing', 'Ice Hockey']);
  });

  it('filters the Upcoming list by sport via the chip row', async () => {
    stubOddsEngineFetch(buildManySportsMatches());
    renderPage();

    await screen.findByRole('link', { name: 'Football Home 1 vs Football Away 1' });
    expect(screen.queryByRole('link', { name: 'Hockey Home 0 vs Hockey Away 0' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Ice Hockey/ }));

    expect(await screen.findByRole('link', { name: 'Hockey Home 0 vs Hockey Away 0' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Football Home/ })).not.toBeInTheDocument();
  });

  it('renders CMS promo cards in the same Challenges slot as the Match of the day row, replacing the static Welcome Bonus card', async () => {
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

    // The "Challenges" aria-label is the desktop right-hand slot next to
    // Match of the day - it should carry the real card, not a whole new
    // section, and the old static Welcome Bonus copy should be gone.
    const promoSlot = await screen.findByRole('group', { name: 'Challenges' });
    expect(within(promoSlot).getByText('Champions League Promo')).toBeInTheDocument();
    expect(within(promoSlot).getByRole('link')).toHaveAttribute('href', '/campaigns/campaign-1');
    expect(screen.queryByText('Welcome Bonus')).not.toBeInTheDocument();
  });

  it('falls back to the static Welcome Bonus card in that same slot when the brand has no promo cards', async () => {
    renderPage();

    const promoSlot = await screen.findByRole('group', { name: 'Challenges' });
    expect(within(promoSlot).getByText('Welcome Bonus')).toBeInTheDocument();
  });
});
