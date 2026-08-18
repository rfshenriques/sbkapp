import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Match } from '@sportsbook/shared';
import { stubOddsEngineFetch } from '../test/mockOddsEngine';
import { useBrandStore } from '../features/brand/brandStore';
import SportPage from './SportPage';

/** Local noon N days from now - "today" by default, safely clear of any midnight rollover near the actual test run time. */
function daysFromNow(days: number, hour = 12): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

function buildMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'm1',
    sport: 'Football',
    country: 'England',
    competition: 'EPL',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    kickoff: daysFromNow(0).toISOString(),
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

function stubDisplayNameOverrides(
  overrides: { entityType: string; rawName: string; displayName: string }[],
) {
  const existingFetch = globalThis.fetch;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url === '/backend/public/display-names') {
      return new Response(JSON.stringify(overrides), { status: 200 });
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

  it('sorts by importance rank once the Time/Relevance order toggle is clicked', async () => {
    stubOddsEngineFetch([
      buildMatch({
        id: 'minor',
        competition: 'League Two',
        kickoff: daysFromNow(0, 9).toISOString(),
        homeTeam: 'Small Club',
        awayTeam: 'Tiny Club',
      }),
      buildMatch({
        id: 'major',
        competition: 'Champions League',
        kickoff: daysFromNow(0, 22).toISOString(),
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

    await userEvent.click(screen.getByRole('button', { name: 'Time' }));

    headings = await screen
      .findAllByRole('link', { name: /vs/ })
      .then((els) => els.map((el) => el.getAttribute('aria-label')));
    expect(headings).toEqual(['Big Club vs Huge Club', 'Small Club vs Tiny Club']);
    expect(screen.getByRole('button', { name: 'Relevance' })).toBeInTheDocument();
  });

  it('hides the Time/Relevance order toggle when only one competition is in view', async () => {
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
    await screen.findByRole('link', { name: 'Arsenal vs Chelsea' });

    expect(screen.queryByRole('button', { name: 'Time' })).not.toBeInTheDocument();
  });

  it('filters matches into Today/Tomorrow/Soon tabs, defaulting to Today', async () => {
    stubOddsEngineFetch([
      buildMatch({
        id: 'today-match',
        kickoff: daysFromNow(0).toISOString(),
        homeTeam: 'Today Home',
        awayTeam: 'Today Away',
      }),
      buildMatch({
        id: 'tomorrow-match',
        kickoff: daysFromNow(1).toISOString(),
        homeTeam: 'Tomorrow Home',
        awayTeam: 'Tomorrow Away',
      }),
      buildMatch({
        id: 'soon-match',
        kickoff: daysFromNow(5).toISOString(),
        homeTeam: 'Soon Home',
        awayTeam: 'Soon Away',
      }),
    ]);
    stubRankingsFetch();

    renderAt('/sports/Football');

    expect(await screen.findByRole('link', { name: 'Today Home vs Today Away' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Tomorrow Home vs Tomorrow Away' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Soon Home vs Soon Away' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Tomorrow' }));
    expect(await screen.findByRole('link', { name: 'Tomorrow Home vs Tomorrow Away' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Today Home vs Today Away' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Soon' }));
    expect(await screen.findByRole('link', { name: 'Soon Home vs Soon Away' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Tomorrow Home vs Tomorrow Away' })).not.toBeInTheDocument();
  });

  it('seeds the date filter from ?date= (e.g. a CMS-configured "Tomorrow\'s matches" nav link)', async () => {
    stubOddsEngineFetch([
      buildMatch({
        id: 'today-match',
        kickoff: daysFromNow(0).toISOString(),
        homeTeam: 'Today Home',
        awayTeam: 'Today Away',
      }),
      buildMatch({
        id: 'tomorrow-match',
        kickoff: daysFromNow(1).toISOString(),
        homeTeam: 'Tomorrow Home',
        awayTeam: 'Tomorrow Away',
      }),
    ]);
    stubRankingsFetch();

    renderAt('/sports/Football?date=tomorrow');

    expect(await screen.findByRole('tab', { name: 'Tomorrow' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByRole('link', { name: 'Tomorrow Home vs Tomorrow Away' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Today Home vs Today Away' })).not.toBeInTheDocument();
  });

  it('always buckets a live match as "today" regardless of its original kickoff', async () => {
    stubOddsEngineFetch([
      buildMatch({
        id: 'live-old',
        isLive: true,
        kickoff: daysFromNow(-3).toISOString(),
        homeTeam: 'Live Home',
        awayTeam: 'Live Away',
      }),
    ]);
    stubRankingsFetch();

    renderAt('/sports/Football');

    expect(await screen.findByRole('link', { name: 'Live Home vs Live Away' })).toBeInTheDocument();
  });

  it('shows a Live filter tab that narrows the list to only live matches, ahead of Today/Tomorrow/Soon', async () => {
    stubOddsEngineFetch([
      buildMatch({ id: 'live1', isLive: true, homeTeam: 'Live Home', awayTeam: 'Live Away' }),
      buildMatch({ id: 'today1', isLive: false, homeTeam: 'Today Home', awayTeam: 'Today Away' }),
    ]);
    stubRankingsFetch();

    renderAt('/sports/Football');
    await screen.findByRole('link', { name: 'Live Home vs Live Away' });

    // Tomorrow/Soon have no matches in this fixture, so they don't render as
    // dead tabs - only Live and Today (which has matches) show.
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Live', 'Today']);

    await userEvent.click(screen.getByRole('tab', { name: 'Live' }));

    expect(await screen.findByRole('link', { name: 'Live Home vs Live Away' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Today Home vs Today Away' })).not.toBeInTheDocument();
  });

  it('hides the Live filter tab on /live itself, since every match shown there is already live', async () => {
    stubOddsEngineFetch([buildMatch({ id: 'm1', isLive: true })]);
    stubRankingsFetch();

    renderAt('/live');
    await screen.findByRole('link', { name: 'Arsenal vs Chelsea' });

    expect(screen.queryByRole('tab', { name: 'Live' })).not.toBeInTheDocument();
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

  it('collapses to only the Soon tab (auto-selected) when the selected competition has nothing live/today/tomorrow', async () => {
    stubOddsEngineFetch([
      buildMatch({
        id: 'far-out',
        competition: 'Premier League',
        kickoff: daysFromNow(10).toISOString(),
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea',
      }),
    ]);
    stubRankingsFetch();

    renderAt('/sports/Football?competition=Premier%20League');

    expect(await screen.findByRole('link', { name: 'Arsenal vs Chelsea' })).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(1);
    expect(tabs[0]).toHaveTextContent('Soon');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('collapses to only the Soon tab on the broad all-countries/all-leagues view too, when nothing is near-term', async () => {
    stubOddsEngineFetch([
      buildMatch({
        id: 'far-out',
        country: 'England',
        competition: 'Premier League',
        kickoff: daysFromNow(10).toISOString(),
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea',
      }),
      buildMatch({
        id: 'far-out-2',
        country: 'Spain',
        competition: 'La Liga',
        kickoff: daysFromNow(12).toISOString(),
        homeTeam: 'Real Madrid',
        awayTeam: 'Barcelona',
      }),
    ]);
    stubRankingsFetch();

    renderAt('/sports/Football');
    await screen.findByRole('tab', { name: 'Soon' });

    // Live/Today/Tomorrow are all empty here, so only Soon (which actually
    // has matches) renders as a tab, whatever the current scope is.
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(1);
    expect(tabs[0]).toHaveTextContent('Soon');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
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

  it('shows sport filter chips on /live, narrowing the live list to the selected sport', async () => {
    stubOddsEngineFetch([
      buildMatch({ id: 'm1', sport: 'Football', isLive: true, homeTeam: 'Arsenal', awayTeam: 'Chelsea' }),
      buildMatch({ id: 'm2', sport: 'Tennis', isLive: true, homeTeam: 'Nadal', awayTeam: 'Federer' }),
      buildMatch({ id: 'm3', sport: 'Football', isLive: false, homeTeam: 'Leeds', awayTeam: 'Norwich' }),
    ]);
    stubRankingsFetch();

    renderAt('/live');

    const filterGroup = within(await screen.findByRole('group', { name: 'Filter by sport' }));
    expect(filterGroup.getByRole('button', { name: /Football/ })).toBeInTheDocument();
    expect(filterGroup.getByRole('button', { name: /Tennis/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Arsenal vs Chelsea' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nadal vs Federer' })).toBeInTheDocument();

    await userEvent.click(filterGroup.getByRole('button', { name: /Tennis/ }));

    expect(screen.getByRole('link', { name: 'Nadal vs Federer' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Arsenal vs Chelsea' })).not.toBeInTheDocument();
  });

  it('hides the sport and date/live filters on a quicklink-driven landing, showing every date bucket unfiltered', async () => {
    stubOddsEngineFetch([
      buildMatch({ id: 'm1', sport: 'Football', homeTeam: 'Arsenal', awayTeam: 'Chelsea', kickoff: daysFromNow(0).toISOString() }),
      buildMatch({ id: 'm2', sport: 'Tennis', homeTeam: 'Nadal', awayTeam: 'Federer', kickoff: daysFromNow(1).toISOString() }),
    ]);
    stubRankingsFetch();

    renderAt('/sports/all?from=quicklink');

    expect(await screen.findByRole('link', { name: 'Arsenal vs Chelsea' })).toBeInTheDocument();
    // Tennis kicks off tomorrow, not today (dateFilter would otherwise
    // default to 'today') - still shown, since a quicklink landing with no
    // explicit date= shows every date bucket rather than silently applying one.
    expect(screen.getByRole('link', { name: 'Nadal vs Federer' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Filter by sport' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist', { name: 'Filter matches by date' })).not.toBeInTheDocument();
  });

  it('keeps the sport and date/live filters on a plain (non-quicklink) visit to the same URL shape', async () => {
    stubOddsEngineFetch([
      buildMatch({ id: 'm1', sport: 'Football', homeTeam: 'Arsenal', awayTeam: 'Chelsea' }),
      buildMatch({ id: 'm2', sport: 'Tennis', homeTeam: 'Nadal', awayTeam: 'Federer' }),
    ]);
    stubRankingsFetch();

    renderAt('/sports/all');

    expect(await screen.findByRole('group', { name: 'Filter by sport' })).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: 'Filter matches by date' })).toBeInTheDocument();
  });

  it('a TODAY/TOMORROW quicklink still locks to its requested date bucket even with the tabs hidden', async () => {
    stubOddsEngineFetch([
      buildMatch({ id: 'm1', sport: 'Football', homeTeam: 'Arsenal', awayTeam: 'Chelsea', kickoff: daysFromNow(0).toISOString() }),
      buildMatch({ id: 'm2', sport: 'Tennis', homeTeam: 'Nadal', awayTeam: 'Federer', kickoff: daysFromNow(1).toISOString() }),
    ]);
    stubRankingsFetch();

    renderAt('/sports/all?date=today&from=quicklink');

    expect(await screen.findByRole('link', { name: 'Arsenal vs Chelsea' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Nadal vs Federer' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist', { name: 'Filter matches by date' })).not.toBeInTheDocument();
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
    // jsdom doesn't evaluate CSS breakpoints, so the mobile and desktop
    // breadcrumb layouts both exist in the DOM - scope to the desktop one
    // (unambiguous for Country here, but Competition is the final segment,
    // duplicated as a pill on the mobile layout too).
    const desktopBreadcrumb = within(screen.getByTestId('breadcrumb-desktop'));

    // Switch country from England to Spain via the breadcrumb.
    await userEvent.click(desktopBreadcrumb.getByRole('button', { name: 'England' }));
    // Each country option in the dropdown shows its circular flag icon.
    expect(within(screen.getByRole('option', { name: 'Spain' })).getByRole('img', { hidden: true })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('option', { name: 'Spain' }));

    expect(await screen.findByRole('link', { name: 'Real Madrid vs Barcelona' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Championship' })).not.toBeInTheDocument();

    // Back in England, switch league from Premier League to Championship.
    await userEvent.click(desktopBreadcrumb.getByRole('button', { name: 'Spain' }));
    await userEvent.click(screen.getByRole('option', { name: 'England' }));
    await within(screen.getByTestId('breadcrumb-desktop')).findByRole('button', { name: 'All leagues' });

    await userEvent.click(desktopBreadcrumb.getByRole('button', { name: 'All leagues' }));
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

  it('shows only the first page of matches, with a Load more button that reveals the rest', async () => {
    // Seconds apart (not hours) so all 25 stay within "today"'s calendar day
    // regardless of when in the day the test actually runs.
    const base = daysFromNow(0).getTime();
    const matches = Array.from({ length: 25 }, (_, index) =>
      buildMatch({
        id: `m${index}`,
        homeTeam: `Home ${index}`,
        awayTeam: `Away ${index}`,
        kickoff: new Date(base + index * 1000).toISOString(),
      }),
    );
    stubOddsEngineFetch(matches);
    stubRankingsFetch();

    renderAt('/sports/Football');

    await screen.findByRole('link', { name: 'Home 0 vs Away 0' });
    expect(screen.getAllByRole('link', { name: /vs/ })).toHaveLength(20);
    expect(screen.queryByRole('link', { name: 'Home 20 vs Away 20' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByRole('link', { name: 'Home 20 vs Away 20' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /vs/ })).toHaveLength(25);
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('shows an empty state when there are no matches for the sport', async () => {
    stubOddsEngineFetch([buildMatch({ sport: 'Football' })]);
    stubRankingsFetch();

    renderAt('/sports/Basketball');

    expect(await screen.findByText('No matches available right now.')).toBeInTheDocument();
  });

  it('shows a backoffice-assigned display name instead of the raw competition name, in both the heading and the breadcrumb', async () => {
    stubOddsEngineFetch([
      buildMatch({ competition: 'UEFA Champions League Qualification' }),
      buildMatch({ id: 'm2', competition: 'Championship', homeTeam: 'Leeds', awayTeam: 'Norwich' }),
    ]);
    stubRankingsFetch();
    stubDisplayNameOverrides([
      {
        entityType: 'COMPETITION',
        rawName: 'UEFA Champions League Qualification',
        displayName: 'UEFA Champions League (Q)',
      },
    ]);

    renderAt('/sports/Football?competition=UEFA%20Champions%20League%20Qualification');

    expect(await screen.findByRole('heading', { name: 'UEFA Champions League (Q)' })).toBeInTheDocument();
    expect(
      within(screen.getByTestId('breadcrumb-desktop')).getByRole('button', { name: 'UEFA Champions League (Q)' }),
    ).toBeInTheDocument();
  });
});
