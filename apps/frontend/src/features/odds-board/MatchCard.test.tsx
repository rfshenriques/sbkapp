import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { matchQueryKey } from '../match-detail/useMatch';
import type { Match } from '../../mocks/types';
import { stubOddsEngineFetch } from '../../test/mockOddsEngine';
import { useBetSlipStore } from '../bet-slip/betSlipStore';
import { MatchCard } from './MatchCard';

const baseMatch: Match = {
  id: 'match-1',
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

    expect(queryClient.getQueryData(matchQueryKey('match-1'))).toBeUndefined();

    await userEvent.hover(screen.getByRole('link', { name: 'Arsenal vs Chelsea' }));

    await waitFor(() => {
      expect(queryClient.getQueryData(matchQueryKey('match-1'))).toEqual(baseMatch);
    });
  });
});
