import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveMatchState } from '@sportsbook/shared';
import { useBetSlipStore } from '../features/bet-slip/betSlipStore';
import { stubOddsEngineFetch } from '../test/mockOddsEngine';
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
    expect(screen.getByText('Premier League')).toBeInTheDocument();
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

  it('shows the live match tracker for a live match once its live state loads', async () => {
    const liveState: LiveMatchState = {
      matchId: 'match-3',
      minute: 57,
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

    expect(await screen.findByText("57'")).toBeInTheDocument();
    expect(screen.getByText('Vinicius Jr')).toBeInTheDocument();
    expect(screen.getByText('Corner Kicks')).toBeInTheDocument();
  });

  it('breadcrumb match dropdown navigates to a sibling match in the same competition', async () => {
    renderAt('match-1');
    await screen.findByRole('heading', { name: 'Arsenal vs Chelsea' });

    await userEvent.click(screen.getByRole('button', { name: 'Arsenal vs Chelsea' }));
    await userEvent.click(screen.getByRole('option', { name: 'Liverpool vs Manchester City' }));

    expect(await screen.findByRole('heading', { name: 'Liverpool vs Manchester City' })).toBeInTheDocument();
  });

  it('lets you add a selection to the bet slip from the match detail page', async () => {
    renderAt('match-1');

    const homeButton = await screen.findByRole('button', { name: 'Home2.10' });
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
