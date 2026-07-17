import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { Match } from '../../mocks/types';
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
});
