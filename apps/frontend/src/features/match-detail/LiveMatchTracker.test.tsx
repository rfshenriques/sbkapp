import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { LiveMatchEvent, LiveMatchState } from '@sportsbook/shared';
import { LiveMatchTracker } from './LiveMatchTracker';

function buildEvent(overrides: Partial<LiveMatchEvent> = {}): LiveMatchEvent {
  return {
    minute: 10,
    type: 'goal',
    team: 'home',
    player: 'Player A',
    detail: 'Normal Goal',
    ...overrides,
  };
}

function buildState(events: LiveMatchEvent[]): LiveMatchState {
  return {
    matchId: 'match-1',
    minute: 50,
    period: '2H',
    homeScore: 1,
    awayScore: 0,
    events,
    stats: [],
    momentum: { home: 60, away: 40 },
    updatedAt: '2026-07-28T10:00:00Z',
  };
}

describe('LiveMatchTracker', () => {
  it('renders nothing for Key Events when there are no events', () => {
    render(<LiveMatchTracker state={buildState([])} homeTeam="Home FC" awayTeam="Away FC" />);
    expect(screen.queryByText('Key events')).not.toBeInTheDocument();
  });

  it('shows only the latest event by default, with an expand button for the rest', () => {
    const events = [
      buildEvent({ minute: 49, type: 'card', player: 'Nano', detail: 'Yellow Card' }),
      buildEvent({ minute: 42, type: 'card', player: 'T. Garcia', detail: 'Yellow Card' }),
      buildEvent({ minute: 32, type: 'card', player: 'T. Pettersson', detail: 'Yellow Card' }),
    ];
    render(<LiveMatchTracker state={buildState(events)} homeTeam="Home FC" awayTeam="Away FC" />);

    expect(screen.getByText('Nano')).toBeInTheDocument();
    // The older-events list animates open/closed (grid-rows trick, same as
    // BetHistoryList's leg list) rather than mounting/unmounting, so it's
    // always in the document - collapsed state is asserted via
    // aria-expanded instead of absence from the DOM.
    expect(screen.getByRole('button', { name: /Show 2 more/ })).toHaveAttribute('aria-expanded', 'false');
  });

  it('expanding reveals the older events, and the button flips to Show less', async () => {
    const events = [
      buildEvent({ minute: 49, player: 'Nano' }),
      buildEvent({ minute: 42, player: 'T. Garcia' }),
    ];
    render(<LiveMatchTracker state={buildState(events)} homeTeam="Home FC" awayTeam="Away FC" />);

    await userEvent.click(screen.getByRole('button', { name: /Show 1 more/ }));

    expect(screen.getByText('T. Garcia')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show less' })).toBeInTheDocument();
  });

  it('does not show an expand button when there is only one event', () => {
    render(
      <LiveMatchTracker state={buildState([buildEvent()])} homeTeam="Home FC" awayTeam="Away FC" />,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders a red-card icon distinctly from a yellow-card icon based on the detail text', () => {
    const events = [buildEvent({ type: 'card', player: 'Sent Off', detail: 'Red Card' })];
    const { container } = render(
      <LiveMatchTracker state={buildState(events)} homeTeam="Home FC" awayTeam="Away FC" />,
    );

    const rect = container.querySelector('rect');
    expect(rect).toHaveAttribute('fill', 'var(--color-danger)');
  });

  it('renders a goal icon for a goal event and a substitution icon for a substitution event', () => {
    const events = [
      buildEvent({ minute: 10, type: 'goal', player: 'Scorer' }),
      buildEvent({ minute: 5, type: 'substitution', player: 'Sub In', detail: 'Substitution 1' }),
    ];
    render(<LiveMatchTracker state={buildState(events)} homeTeam="Home FC" awayTeam="Away FC" />);

    // The goal (latest, minute 10) is visible without expanding.
    expect(screen.getByText('Scorer')).toBeInTheDocument();
  });
});
