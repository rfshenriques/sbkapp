import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { Match } from '@sportsbook/shared';
import { CompetitionDrilldown } from './CompetitionDrilldown';

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

describe('CompetitionDrilldown', () => {
  it('shows the empty message when there are no matches', () => {
    render(<CompetitionDrilldown matches={[]} renderCompetition={() => null} />);
    expect(screen.getByText("No competitions yet - they'll appear here once matches are live.")).toBeInTheDocument();
  });

  it('lists competitions directly once a country is expanded, no further drill-down needed', async () => {
    const matches = [
      buildMatch({ competition: 'Premier League' }),
      buildMatch({ id: 'm2', competition: 'Championship' }),
    ];
    render(
      <CompetitionDrilldown
        matches={matches}
        renderCompetition={(competition) => <span>competition:{competition}</span>}
      />,
    );

    expect(screen.queryByText('competition:Premier League')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Football/ }));
    await userEvent.click(screen.getByRole('button', { name: /England/ }));

    expect(screen.getByText('competition:Premier League')).toBeInTheDocument();
    expect(screen.getByText('competition:Championship')).toBeInTheDocument();
  });
});
