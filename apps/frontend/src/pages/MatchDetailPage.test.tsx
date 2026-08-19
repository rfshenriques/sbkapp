import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveMatchState } from '@sportsbook/shared';
import { useBetSlipStore } from '../features/bet-slip/betSlipStore';
import { stubOddsEngineFetch, TEST_BRAND_ID } from '../test/mockOddsEngine';
import MatchDetailPage from './MatchDetailPage';

function renderAt(matchId: string) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/matches/${matchId}`]}>
        <Routes>
          <Route path="/matches/:matchId" element={<MatchDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useBetSlipStore.setState({ selections: [] });
  stubOddsEngineFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MatchDetailPage', () => {
  it('shows a loading state, then the match details, for a known match id', async () => {
    renderAt('match-1');

    expect(screen.getByRole('status', { name: 'Loading match' })).toBeInTheDocument();

    expect(await screen.findByRole('heading', { name: 'Arsenal vs Chelsea' })).toBeInTheDocument();
    // "Premier League" appears in both the mobile and desktop breadcrumb
    // layouts (jsdom doesn't evaluate CSS breakpoints, so both exist in the
    // DOM at once) - just check it's present at least once.
    expect(screen.getAllByText('Premier League').length).toBeGreaterThan(0);
    expect(screen.getByText('2.10')).toBeInTheDocument();
  });

  it('shows a not-found message for an unknown match id', async () => {
    renderAt('does-not-exist');

    expect(await screen.findByText('Match not found.')).toBeInTheDocument();
  });

  it('shows a no-odds message when the match has no markets yet', async () => {
    stubOddsEngineFetch([
      {
        id: 'match-6',
        sport: 'Football',
        country: 'England',
        competition: 'Some Small League',
        homeTeam: 'Home Team',
        awayTeam: 'Away Team',
        kickoff: '2026-07-20T15:00:00Z',
        isLive: false,
        markets: [],
      },
    ]);

    renderAt('match-6');

    expect(await screen.findByText('No odds available for this match yet.')).toBeInTheDocument();
  });

  it('renders every other market on the match below Match Result, manual markets included', async () => {
    stubOddsEngineFetch([
      {
        id: 'match-7',
        sport: 'Football',
        country: 'England',
        competition: 'Some Small League',
        homeTeam: 'Home Team',
        awayTeam: 'Away Team',
        kickoff: '2026-07-20T15:00:00Z',
        isLive: false,
        markets: [
          {
            id: 'match-result',
            name: 'Match Result',
            selections: [{ id: 'home', name: 'Home', odds: 1.5 }],
          },
          {
            id: 'manual-1',
            name: 'To Win Both Halves',
            selections: [
              { id: 'yes', name: 'Yes', odds: 3.5 },
              { id: 'no', name: 'No', odds: 1.25 },
            ],
          },
        ],
      },
    ]);

    renderAt('match-7');

    expect(await screen.findByText('Match Result')).toBeInTheDocument();
    expect(await screen.findByText('To Win Both Halves')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Yes3.50' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No1.25' })).toBeInTheDocument();
  });

  it('stacks every manual (isSpecial) market together under one Specials heading, separate from real markets', async () => {
    stubOddsEngineFetch([
      {
        id: 'match-8',
        sport: 'Football',
        country: 'England',
        competition: 'Some Small League',
        homeTeam: 'Home Team',
        awayTeam: 'Away Team',
        kickoff: '2026-07-20T15:00:00Z',
        isLive: false,
        markets: [
          {
            id: 'match-result',
            name: 'Match Result',
            selections: [{ id: 'home', name: 'Home', odds: 1.5 }],
          },
          {
            id: 'manual-1',
            name: 'To Win Both Halves',
            isSpecial: true,
            selections: [{ id: 'yes', name: 'Yes', odds: 3.5 }],
          },
          {
            id: 'manual-2',
            name: 'Anytime Assist',
            isSpecial: true,
            selections: [{ id: 'saka', name: 'Saka', odds: 4.0 }],
          },
        ],
      },
    ]);

    renderAt('match-8');

    const specialsHeading = await screen.findByRole('heading', { name: 'Specials' });
    expect(specialsHeading).toBeInTheDocument();
    // Both manual markets sit inside the same Specials section, not each
    // getting their own top-level heading the way a real market would.
    const specialsSection = specialsHeading.closest('div')!.parentElement!;
    expect(within(specialsSection).getByText('To Win Both Halves')).toBeInTheDocument();
    expect(within(specialsSection).getByText('Anytime Assist')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'To Win Both Halves' })).not.toBeInTheDocument();
  });

  it("shows 'Singles only' alongside the max stake for a singles-only special market", async () => {
    stubOddsEngineFetch([
      {
        id: 'match-8b',
        sport: 'Football',
        country: 'England',
        competition: 'Some Small League',
        homeTeam: 'Home Team',
        awayTeam: 'Away Team',
        kickoff: '2026-07-20T15:00:00Z',
        isLive: false,
        markets: [
          {
            id: 'match-result',
            name: 'Match Result',
            selections: [{ id: 'home', name: 'Home', odds: 1.5 }],
          },
          {
            id: 'manual-1',
            name: 'To Win Both Halves',
            isSpecial: true,
            singlesOnly: true,
            maxStakeCents: 1_500,
            selections: [{ id: 'yes', name: 'Yes', odds: 3.5 }],
          },
        ],
      },
    ]);

    renderAt('match-8b');

    expect(await screen.findByText('Max stake: 15.00 € · Singles only')).toBeInTheDocument();
  });

  it('shows a Boosts section above Match Result, listing every boosted selection on the match', async () => {
    stubOddsEngineFetch([
      {
        id: 'match-9',
        sport: 'Football',
        country: 'England',
        competition: 'Some Small League',
        homeTeam: 'Home Team',
        awayTeam: 'Away Team',
        kickoff: '2026-07-20T15:00:00Z',
        isLive: false,
        markets: [
          {
            id: 'match-result',
            name: 'Match Result',
            selections: [
              { id: 'home', name: 'Home', odds: 2.4, originalOdds: 1.85, maxStakeCents: 5000 },
              { id: 'away', name: 'Away', odds: 3.2 },
            ],
          },
        ],
      },
    ]);

    renderAt('match-9');

    const boostsHeading = await screen.findByRole('heading', { name: 'Boosts' });
    expect(boostsHeading).toBeInTheDocument();
    // The Boosts section sits above the Match Result heading in document order.
    const matchResultHeading = await screen.findByRole('heading', { name: 'Match Result' });
    expect(
      boostsHeading.compareDocumentPosition(matchResultHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // The boosted selection also still appears in its normal Match Result
    // row below (same rule as the player Boosts page vs. the match page),
    // so scope to the Boosts section itself rather than the whole page.
    const boostsSection = boostsHeading.closest('div')!.parentElement!;
    expect(within(boostsSection).getByText('Max stake for boosted price: 50.00 €')).toBeInTheDocument();
    expect(
      within(boostsSection).getByRole('button', { name: /Home boosted to 2.40, was 1.85, max stake 50.00 €/ }),
    ).toBeInTheDocument();
  });

  it('does not show a Boosts section when nothing on the match is boosted', async () => {
    renderAt('match-1');
    await screen.findByRole('heading', { name: 'Arsenal vs Chelsea' });

    expect(screen.queryByRole('heading', { name: 'Boosts' })).not.toBeInTheDocument();
  });

  it('shows the live match tracker for a live match once its live state loads', async () => {
    const liveState: LiveMatchState = {
      matchId: 'match-3',
      minute: 57,
      period: '2H',
      homeScore: 2,
      awayScore: 1,
      events: [
        {
          minute: 40,
          type: 'goal',
          team: 'home',
          player: 'Vinicius Jr',
          detail: 'Normal Goal',
          assistPlayer: 'Jude Bellingham',
        },
      ],
      stats: [{ type: 'Corner Kicks', home: 5, away: 2 }],
      momentum: { home: 65, away: 35 },
      updatedAt: '2026-07-17T22:40:00.000Z',
    };
    stubOddsEngineFetch(undefined, { 'match-3': liveState });

    renderAt('match-3');

    expect(await screen.findByText("2nd Half · 57'")).toBeInTheDocument();
    expect(screen.getByText('Vinicius Jr')).toBeInTheDocument();
    expect(screen.getByText('Corner Kicks')).toBeInTheDocument();
  });

  it('breadcrumb match dropdown navigates to a sibling match in the same competition', async () => {
    renderAt('match-1');
    await screen.findByRole('heading', { name: 'Arsenal vs Chelsea' });

    // jsdom doesn't evaluate CSS breakpoints, so the mobile and desktop
    // breadcrumb layouts both exist in the DOM - Match is the final segment,
    // duplicated as a pill on the mobile layout too, so scope to desktop.
    const desktopBreadcrumb = within(screen.getByTestId('breadcrumb-desktop'));
    await userEvent.click(desktopBreadcrumb.getByRole('button', { name: /Arsenal vs Chelsea/ }));
    await userEvent.click(screen.getByRole('option', { name: /Liverpool vs Manchester City/ }));

    expect(await screen.findByRole('heading', { name: 'Liverpool vs Manchester City' })).toBeInTheDocument();
  });

  it('shows a Live indicator (not a kickoff time) for a live sibling match in the breadcrumb dropdown', async () => {
    const { mockMatches } = await import('../mocks/matches');
    const liveSiblingMatches = mockMatches.map((match) =>
      match.id === 'match-2' ? { ...match, isLive: true } : match,
    );
    stubOddsEngineFetch(liveSiblingMatches);

    renderAt('match-1');
    await screen.findByRole('heading', { name: 'Arsenal vs Chelsea' });

    const desktopBreadcrumb = within(screen.getByTestId('breadcrumb-desktop'));
    await userEvent.click(desktopBreadcrumb.getByRole('button', { name: /Arsenal vs Chelsea/ }));

    const siblingOption = screen.getByRole('option', { name: /Liverpool vs Manchester City/ });
    expect(within(siblingOption).getByText('Live')).toBeInTheDocument();
  });

  it('shows a MARKET display-name override on the market heading instead of the raw feed name', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === `/backend/public/matches/${TEST_BRAND_ID}`) {
        const { mockMatches } = await import('../mocks/matches');
        return new Response(JSON.stringify(mockMatches), { status: 200 });
      }
      if (url === `/backend/public/matches/${TEST_BRAND_ID}/match-1`) {
        const { mockMatches } = await import('../mocks/matches');
        const match = mockMatches.find((candidate) => candidate.id === 'match-1');
        return new Response(JSON.stringify(match), { status: 200 });
      }
      if (url === '/backend/public/display-names') {
        return new Response(
          JSON.stringify([{ entityType: 'MARKET', rawName: 'Match Result', displayName: 'Fulltime Result' }]),
          { status: 200 },
        );
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderAt('match-1');

    expect(await screen.findByRole('heading', { name: 'Fulltime Result' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Match Result' })).not.toBeInTheDocument();
  });

  it('lets you add a selection to the bet slip from the match detail page', async () => {
    renderAt('match-1');

    const homeButton = await screen.findByRole('button', { name: 'Arsenal2.10' });
    await userEvent.click(homeButton);

    expect(useBetSlipStore.getState().selections).toEqual([
      {
        matchId: 'match-1',
        marketId: 'match-result',
        selectionId: 'home',
        matchLabel: 'Arsenal vs Chelsea',
        marketName: 'Match Result',
        selectionName: 'Home',
        odds: 2.1,
      },
    ]);
  });
});
