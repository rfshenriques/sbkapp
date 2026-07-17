import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
