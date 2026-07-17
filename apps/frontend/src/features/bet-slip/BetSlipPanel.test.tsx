import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { BetSlipPanel } from './BetSlipPanel';
import { useBetSlipStore } from './betSlipStore';

const homeSelection = {
  matchId: 'match-1',
  marketId: 'match-result',
  selectionId: 'home',
  matchLabel: 'Arsenal vs Chelsea',
  marketName: 'Match Result',
  selectionName: 'Home',
  odds: 2.1,
};

const awaySelection = {
  matchId: 'match-2',
  marketId: 'match-result',
  selectionId: 'away',
  matchLabel: 'Liverpool vs Manchester City',
  marketName: 'Match Result',
  selectionName: 'Away',
  odds: 2.5,
};

beforeEach(() => {
  useBetSlipStore.setState({ selections: [] });
});

describe('BetSlipPanel', () => {
  it('shows an empty state when there are no selections', () => {
    render(<BetSlipPanel />);

    expect(screen.getByText('Your bet slip is empty.')).toBeInTheDocument();
  });

  it('lists every selection with its combined odds', () => {
    useBetSlipStore.setState({ selections: [homeSelection, awaySelection] });
    render(<BetSlipPanel />);

    expect(screen.getByText('Arsenal vs Chelsea')).toBeInTheDocument();
    expect(screen.getByText('Match Result: Home')).toBeInTheDocument();
    expect(screen.getByText('Liverpool vs Manchester City')).toBeInTheDocument();

    // combined odds = 2.1 * 2.5 = 5.25
    expect(screen.getByText('5.25')).toBeInTheDocument();
  });

  it('removes a selection when its remove button is clicked', async () => {
    useBetSlipStore.setState({ selections: [homeSelection, awaySelection] });
    render(<BetSlipPanel />);

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove Home for Arsenal vs Chelsea' }),
    );

    expect(useBetSlipStore.getState().selections).toEqual([awaySelection]);
  });

  it('clears every selection when Clear is clicked', async () => {
    useBetSlipStore.setState({ selections: [homeSelection, awaySelection] });
    render(<BetSlipPanel />);

    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(useBetSlipStore.getState().selections).toEqual([]);
  });

  it('disables the Place Bet button', () => {
    useBetSlipStore.setState({ selections: [homeSelection] });
    render(<BetSlipPanel />);

    expect(screen.getByRole('button', { name: 'Place Bet' })).toBeDisabled();
  });
});
