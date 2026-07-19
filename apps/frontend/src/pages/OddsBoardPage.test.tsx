import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Match } from '@sportsbook/shared';
import { stubOddsEngineFetch } from '../test/mockOddsEngine';
import { useBetSlipStore } from '../features/bet-slip/betSlipStore';
import OddsBoardPage from './OddsBoardPage';

function buildMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'm1',
    sport: 'Football',
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

    expect(await screen.findByText('Arsenal vs Chelsea')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Loading matches' })).not.toBeInTheDocument();
  });

  it('navigates to the featured match when clicking anywhere on its card', async () => {
    renderPageWithRouting();

    // mockMatches' only live fixture (Real Madrid vs Barcelona) sorts first.
    await screen.findByText('Real Madrid vs Barcelona');
    // "Live now" only appears once, in the featured card's own badge.
    await userEvent.click(screen.getByText('Live now'));

    expect(await screen.findByText('Match detail page')).toBeInTheDocument();
  });

  it('does not navigate when picking an odd on the featured card', async () => {
    renderPageWithRouting();

    await screen.findByText('Real Madrid vs Barcelona');
    const oddsButtons = screen.getAllByRole('button', { name: /Home/ });
    await userEvent.click(oddsButtons[0] as HTMLElement);

    expect(screen.queryByText('Match detail page')).not.toBeInTheDocument();
    expect(useBetSlipStore.getState().selections).toHaveLength(1);
  });

  it('caps the Upcoming list at 10 and shows a Load more link to the sport page', async () => {
    stubOddsEngineFetch(buildManySportsMatches());
    renderPage();

    await screen.findByText('Football Home 1 vs Football Away 1');
    // 13 football matches, minus 1 taken as "Featured", leaves 12 - capped to 10 visible here.
    expect(screen.getAllByText(/Football Home \d+ vs Football Away \d+/)).toHaveLength(10);

    const loadMore = screen.getByRole('link', { name: 'Load more Football matches →' });
    expect(loadMore).toHaveAttribute('href', '/sports/Football');
  });

  it('filters the Upcoming list by sport via the chip row', async () => {
    stubOddsEngineFetch(buildManySportsMatches());
    renderPage();

    await screen.findByText('Football Home 1 vs Football Away 1');
    expect(screen.queryByText('Hockey Home 0 vs Hockey Away 0')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Ice Hockey' }));

    expect(await screen.findByText('Hockey Home 0 vs Hockey Away 0')).toBeInTheDocument();
    expect(screen.queryByText(/Football Home/)).not.toBeInTheDocument();
  });
});
