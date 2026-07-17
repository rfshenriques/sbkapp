import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Match } from '../../mocks/types';
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
  return render(
    <MemoryRouter>
      <MatchCard match={match} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useBetSlipStore.setState({ selections: [] });
});

describe('MatchCard', () => {
  it('renders the competition, teams, and a link to the match detail page', () => {
    renderMatchCard(baseMatch);

    expect(screen.getByText('Premier League')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Arsenal vs Chelsea' });
    expect(link).toHaveAttribute('href', '/matches/match-1');
  });

  it('renders every selection with its odds', () => {
    renderMatchCard(baseMatch);

    const buttons = screen.getAllByRole('button');
    const texts = buttons.map((button) => button.textContent);
    expect(texts).toEqual(['Home2.10', 'Draw3.40', 'Away3.20']);
  });

  it('shows a LIVE badge only when the match is live', () => {
    const { rerender } = render(
      <MemoryRouter>
        <MatchCard match={baseMatch} />
      </MemoryRouter>,
    );
    expect(screen.queryByText('LIVE')).not.toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <MatchCard match={{ ...baseMatch, isLive: true }} />
      </MemoryRouter>,
    );
    expect(screen.getByText('LIVE')).toBeInTheDocument();
  });

  it('adds a selection to the bet slip store when clicked', async () => {
    renderMatchCard(baseMatch);

    await userEvent.click(screen.getByRole('button', { name: 'Home2.10' }));

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

  it('clicking a different selection in the same market replaces the pick', async () => {
    renderMatchCard(baseMatch);

    await userEvent.click(screen.getByRole('button', { name: 'Home2.10' }));
    await userEvent.click(screen.getByRole('button', { name: 'Away3.20' }));

    const selections = useBetSlipStore.getState().selections;
    expect(selections).toHaveLength(1);
    expect(selections[0]?.selectionId).toBe('away');
  });

  it('clicking the same selection twice removes it', async () => {
    renderMatchCard(baseMatch);

    const homeButton = screen.getByRole('button', { name: 'Home2.10' });
    await userEvent.click(homeButton);
    await userEvent.click(homeButton);

    expect(useBetSlipStore.getState().selections).toEqual([]);
  });
});
