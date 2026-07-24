import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { Match } from '@sportsbook/shared';
import { MatchDrilldown } from './MatchDrilldown';

function buildMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'm1',
    sport: 'Football',
    country: 'England',
    competition: 'Premier League',
    homeTeam: 'Home',
    awayTeam: 'Away',
    kickoff: '2026-07-19T18:00:00Z',
    isLive: false,
    markets: [],
    ...overrides,
  };
}

describe('MatchDrilldown', () => {
  it('shows the empty message when there are no matches', () => {
    render(<MatchDrilldown matches={[]} renderLeague={() => null} />);
    expect(screen.getByText('No live matches right now.')).toBeInTheDocument();
  });

  it('shows a loading state', () => {
    render(<MatchDrilldown matches={undefined} isLoading renderLeague={() => null} />);
    expect(screen.getByText('Loading live matches…')).toBeInTheDocument();
  });

  it('only renders the league content once drilled all the way down to it', async () => {
    const matches = [
      buildMatch({ id: 'm1', sport: 'Football', country: 'England', competition: 'Premier League' }),
    ];
    render(<MatchDrilldown matches={matches} renderLeague={(node) => <p>{node.matches.length} match(es)</p>} />);

    expect(screen.queryByText('1 match(es)')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Football/ }));
    expect(screen.queryByText('1 match(es)')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /England/ }));
    expect(screen.queryByText('1 match(es)')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Premier League/ }));
    expect(screen.getByText('1 match(es)')).toBeInTheDocument();
  });

  it('collapses country and league selection when switching to a different sport', async () => {
    const matches = [
      buildMatch({ id: 'm1', sport: 'Football', country: 'England', competition: 'Premier League' }),
      buildMatch({ id: 'm2', sport: 'Tennis', country: 'International', competition: 'ATP Finals' }),
    ];
    render(<MatchDrilldown matches={matches} renderLeague={(node) => <p>league:{node.competition}</p>} />);

    await userEvent.click(screen.getByRole('button', { name: /Football/ }));
    await userEvent.click(screen.getByRole('button', { name: /England/ }));
    await userEvent.click(screen.getByRole('button', { name: /Premier League/ }));
    expect(screen.getByText('league:Premier League')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Tennis/ }));
    expect(screen.queryByText('league:Premier League')).not.toBeInTheDocument();
    // Tennis's own country level is now visible (freshly expanded sport), but not drilled any further.
    expect(screen.getByRole('button', { name: /International/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ATP Finals/ })).not.toBeInTheDocument();
  });
});
