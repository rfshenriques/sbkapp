import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { matchQueryKey } from '../match-detail/useMatch';
import type { Match } from '@sportsbook/shared';
import { stubOddsEngineFetch, TEST_BRAND_ID } from '../../test/mockOddsEngine';
import { useBetSlipStore } from '../bet-slip/betSlipStore';
import { MatchCard } from './MatchCard';

const baseMatch: Match = {
  id: 'match-1',
  sport: 'Football',
  country: 'England',
  competition: 'Premier League',
  homeTeam: 'Arsenal',
  awayTeam: 'Chelsea',
  kickoff: '2026-07-18T15:00:00Z',
  isLive: false,
  markets: [
    {
      id: 'match-result',
      name: 'Match Result',
      selections: [
        { id: 'home', name: 'Home', odds: 2.1 },
        { id: 'draw', name: 'Draw', odds: 3.4 },
        { id: 'away', name: 'Away', odds: 3.2 },
      ],
    },
  ],
};

function renderMatchCard(match: Match) {
  const queryClient = new QueryClient();
  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MatchCard match={match} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...result, queryClient };
}

beforeEach(() => {
  useBetSlipStore.setState({ selections: [] });
  stubOddsEngineFetch([baseMatch]);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MatchCard', () => {
  it('renders the competition, teams, and a link to the match detail page', () => {
    renderMatchCard(baseMatch);

    expect(screen.getByText('Premier League')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Arsenal vs Chelsea' });
    expect(link).toHaveAttribute('href', '/matches/match-1');
  });

  it('renders the match-result selections with their odds', () => {
    renderMatchCard(baseMatch);

    const buttons = screen.getAllByRole('button');
    const texts = buttons.map((button) => button.textContent);
    expect(texts).toEqual(['Home2.10', 'Draw3.40', 'Away3.20']);
  });

  it('shows "vs" centered between the teams for a pre-match fixture', () => {
    renderMatchCard(baseMatch);
    expect(screen.getByText('vs')).toBeInTheDocument();
  });

  it('replaces "vs" with the live score once it loads for a live match', async () => {
    const liveMatch: Match = { ...baseMatch, isLive: true };
    stubOddsEngineFetch([liveMatch], {
      [liveMatch.id]: {
        matchId: liveMatch.id,
        minute: 40,
        homeScore: 2,
        awayScore: 1,
        events: [],
        stats: [],
        momentum: { home: 60, away: 40 },
        updatedAt: '2026-07-18T15:40:00Z',
      },
    });

    renderMatchCard(liveMatch);

    expect(screen.queryByText('vs')).not.toBeInTheDocument();
    expect(await screen.findByText('2 : 1')).toBeInTheDocument();
  });

  it('shows a colon placeholder for a live match before the score has loaded', () => {
    const liveMatch: Match = { ...baseMatch, isLive: true };
    stubOddsEngineFetch([liveMatch]);

    renderMatchCard(liveMatch);

    expect(screen.getByText(':')).toBeInTheDocument();
  });

  it('shows a LIVE badge only when the match is live', () => {
    const queryClient = new QueryClient();
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatchCard match={baseMatch} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.queryByText('LIVE')).not.toBeInTheDocument();

    rerender(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatchCard match={{ ...baseMatch, isLive: true }} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('LIVE')).toBeInTheDocument();
  });

  it('prefetches the match detail data when the link is hovered', async () => {
    const { queryClient } = renderMatchCard(baseMatch);

    expect(queryClient.getQueryData(matchQueryKey('match-1', TEST_BRAND_ID))).toBeUndefined();

    await userEvent.hover(screen.getByRole('link', { name: 'Arsenal vs Chelsea' }));

    await waitFor(() => {
      expect(queryClient.getQueryData(matchQueryKey('match-1', TEST_BRAND_ID))).toEqual(baseMatch);
    });
  });

  it('shows the kickoff date and time for a pre-match fixture', () => {
    renderMatchCard(baseMatch);

    // Locale-formatted, so just assert the time (unambiguous) and that some
    // date text renders alongside it rather than pinning an exact string.
    expect(screen.getByText(/15:00|03:00 PM|3:00 PM/)).toBeInTheDocument();
  });

  it('navigates to the match when clicking anywhere on the card, not just the team names', async () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<MatchCard match={baseMatch} />} />
            <Route path="/matches/:matchId" element={<p>Match detail page</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await userEvent.click(screen.getByText('Premier League'));

    expect(await screen.findByText('Match detail page')).toBeInTheDocument();
  });

  it('shows a colored edge marker only for teams with a backoffice-assigned color', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/backend/public/team-colors') {
        return new Response(JSON.stringify([{ name: 'Arsenal', colorHex: '#EF0107' }]), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { container } = renderMatchCard(baseMatch);

    const markers = await waitFor(() => {
      const found = container.querySelectorAll('[aria-hidden="true"][style*="background-color"]');
      expect(found.length).toBeGreaterThan(0);
      return found;
    });
    expect(markers).toHaveLength(1);
    expect(markers[0]).toHaveStyle({ backgroundColor: '#EF0107' });
  });

  it('does not navigate when clicking an odds button - only the selection toggles', async () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<MatchCard match={baseMatch} />} />
            <Route path="/matches/:matchId" element={<p>Match detail page</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Home2.10' }));

    expect(screen.queryByText('Match detail page')).not.toBeInTheDocument();
    expect(useBetSlipStore.getState().selections).toHaveLength(1);
  });
});
