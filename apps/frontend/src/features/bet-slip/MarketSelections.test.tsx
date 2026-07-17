import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Market } from '@sportsbook/shared';
import { MarketSelections } from './MarketSelections';
import { useBetSlipStore } from './betSlipStore';

const matchResult: Market = {
  id: 'match-result',
  name: 'Match Result',
  selections: [
    { id: 'home', name: 'Home', odds: 2.1 },
    { id: 'draw', name: 'Draw', odds: 3.4 },
    { id: 'away', name: 'Away', odds: 3.2 },
  ],
};

beforeEach(() => {
  useBetSlipStore.setState({ selections: [] });
});

function renderMarketSelections() {
  return render(
    <MarketSelections matchId="match-1" matchLabel="Arsenal vs Chelsea" market={matchResult} />,
  );
}

describe('MarketSelections', () => {
  it('renders every selection with its odds', () => {
    renderMarketSelections();

    const buttons = screen.getAllByRole('button');
    const texts = buttons.map((button) => button.textContent);
    expect(texts).toEqual(['Home2.10', 'Draw3.40', 'Away3.20']);
  });

  it('adds a selection to the bet slip store when clicked', async () => {
    renderMarketSelections();

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
    renderMarketSelections();

    await userEvent.click(screen.getByRole('button', { name: 'Home2.10' }));
    await userEvent.click(screen.getByRole('button', { name: 'Away3.20' }));

    const selections = useBetSlipStore.getState().selections;
    expect(selections).toHaveLength(1);
    expect(selections[0]?.selectionId).toBe('away');
  });

  it('clicking the same selection twice removes it', async () => {
    renderMarketSelections();

    const homeButton = screen.getByRole('button', { name: 'Home2.10' });
    await userEvent.click(homeButton);
    await userEvent.click(homeButton);

    expect(useBetSlipStore.getState().selections).toEqual([]);
  });
});
