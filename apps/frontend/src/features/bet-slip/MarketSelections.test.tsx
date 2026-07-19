import type { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  // MarketSelections now resolves display-name overrides - no override set
  // in these tests, so this just needs to resolve without throwing.
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 })));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderWithQueryClient(ui: ReactElement) {
  const queryClient = new QueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function renderMarketSelections() {
  return renderWithQueryClient(
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

  it('applies MARKET/SELECTION display-name overrides to the label and the captured bet slip selection', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([
            { entityType: 'MARKET', rawName: 'Match Result', displayName: '1X2' },
            { entityType: 'SELECTION', rawName: 'Home', displayName: '1' },
          ]),
          { status: 200 },
        ),
      ),
    );

    renderMarketSelections();

    const homeButton = await screen.findByRole('button', { name: '12.10' });
    await userEvent.click(homeButton);

    expect(useBetSlipStore.getState().selections).toEqual([
      expect.objectContaining({ marketName: '1X2', selectionName: '1' }),
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

  it('splits the row evenly across however many selections a market has (3-way)', () => {
    const { container } = renderMarketSelections();
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe('repeat(3, minmax(0, 1fr))');
  });

  it('splits the row 50/50 for a 2-way market', () => {
    const twoWay: Market = {
      id: 'match-result',
      name: 'Match Result',
      selections: [
        { id: 'home', name: 'Home', odds: 2.0 },
        { id: 'away', name: 'Away', odds: 1.8 },
      ],
    };
    const { container } = renderWithQueryClient(
      <MarketSelections matchId="match-1" matchLabel="Arsenal vs Chelsea" market={twoWay} />,
    );
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))');
  });

  it('fills the whole row for a single-outcome market', () => {
    const oneWay: Market = {
      id: 'winner',
      name: 'Outright Winner',
      selections: [{ id: 'team-a', name: 'Team A', odds: 1.5 }],
    };
    const { container } = renderWithQueryClient(
      <MarketSelections matchId="match-1" matchLabel="Arsenal vs Chelsea" market={oneWay} />,
    );
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe('repeat(1, minmax(0, 1fr))');
  });
});
