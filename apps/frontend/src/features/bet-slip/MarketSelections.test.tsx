import type { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Market } from '@sportsbook/shared';
import { useBrandStore } from '../brand/brandStore';
import { MarketSelections } from './MarketSelections';
import { useBetSlipStore } from './betSlipStore';

const COMPETITION = 'Premier League';

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
  useBrandStore.setState({ brandId: undefined });
});

function renderWithQueryClient(ui: ReactElement) {
  const queryClient = new QueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function renderMarketSelections() {
  return renderWithQueryClient(
    <MarketSelections
      matchId="match-1"
      matchLabel="Arsenal vs Chelsea"
      competition={COMPETITION}
      market={matchResult}
    />,
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
      <MarketSelections
        matchId="match-1"
        matchLabel="Arsenal vs Chelsea"
        competition={COMPETITION}
        market={twoWay}
      />,
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
      <MarketSelections
        matchId="match-1"
        matchLabel="Arsenal vs Chelsea"
        competition={COMPETITION}
        market={oneWay}
      />,
    );
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe('repeat(1, minmax(0, 1fr))');
  });

  it('flashes the whole odd button green on a rise and red on a drop, clearing after a moment', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const queryClient = new QueryClient();
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <MarketSelections
          matchId="match-1"
          matchLabel="Arsenal vs Chelsea"
          competition={COMPETITION}
          market={matchResult}
        />
      </QueryClientProvider>,
    );

    const homeButton = () => screen.getByRole('button', { name: /^Home/ });
    expect(homeButton().className).not.toMatch(/flash-/);

    rerender(
      <QueryClientProvider client={queryClient}>
        <MarketSelections
          matchId="match-1"
          matchLabel="Arsenal vs Chelsea"
          competition={COMPETITION}
          market={{ ...matchResult, selections: [{ id: 'home', name: 'Home', odds: 2.5 }, ...matchResult.selections.slice(1)] }}
        />
      </QueryClientProvider>,
    );
    expect(homeButton().className).toContain('flash-up');

    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(homeButton().className).not.toMatch(/flash-/);

    rerender(
      <QueryClientProvider client={queryClient}>
        <MarketSelections
          matchId="match-1"
          matchLabel="Arsenal vs Chelsea"
          competition={COMPETITION}
          market={{ ...matchResult, selections: [{ id: 'home', name: 'Home', odds: 1.8 }, ...matchResult.selections.slice(1)] }}
        />
      </QueryClientProvider>,
    );
    expect(homeButton().className).toContain('flash-down');

    vi.useRealTimers();
  });

  it('mutes every selection and shows a lock icon instead of odds when the whole market is suspended', async () => {
    useBrandStore.setState({ brandId: 'brand-1' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url === '/backend/public/market-suspensions/brand-1') {
          return new Response(
            JSON.stringify([{ matchId: 'match-1', marketId: 'match-result', selectionId: '' }]),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify([]), { status: 200 });
      }),
    );

    renderMarketSelections();

    const homeButton = await screen.findByRole('button', { name: 'Home suspended' });
    expect(homeButton).toBeDisabled();
    expect(homeButton.querySelector('.odd-value')).toBeNull();
    expect(homeButton.querySelector('svg')).not.toBeNull();
    // Every other selection in the market is muted too.
    expect(screen.getByRole('button', { name: 'Draw suspended' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Away suspended' })).toBeDisabled();

    await userEvent.click(homeButton);
    expect(useBetSlipStore.getState().selections).toEqual([]);
  });

  it('mutes only the specific selection when just that selection is suspended', async () => {
    useBrandStore.setState({ brandId: 'brand-1' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url === '/backend/public/market-suspensions/brand-1') {
          return new Response(
            JSON.stringify([{ matchId: 'match-1', marketId: 'match-result', selectionId: 'home' }]),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify([]), { status: 200 });
      }),
    );

    renderMarketSelections();

    expect(await screen.findByRole('button', { name: 'Home suspended' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Draw3.40' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Away3.20' })).not.toBeDisabled();
  });

  it('mutes every selection in every market when the competition is suspended', async () => {
    useBrandStore.setState({ brandId: 'brand-1' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url === '/backend/public/competition-suspensions/brand-1') {
          return new Response(JSON.stringify([COMPETITION]), { status: 200 });
        }
        return new Response(JSON.stringify([]), { status: 200 });
      }),
    );

    renderMarketSelections();

    expect(await screen.findByRole('button', { name: 'Home suspended' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Draw suspended' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Away suspended' })).toBeDisabled();
  });

  it('does not suspend a different match sharing the same market name', async () => {
    useBrandStore.setState({ brandId: 'brand-1' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url === '/backend/public/market-suspensions/brand-1') {
          return new Response(
            JSON.stringify([{ matchId: 'some-other-match', marketId: 'match-result', selectionId: '' }]),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify([]), { status: 200 });
      }),
    );

    renderMarketSelections();

    const homeButton = await screen.findByRole('button', { name: 'Home2.10' });
    expect(homeButton).not.toBeDisabled();
  });

  it('shows only the new boosted price (no struck-through previous price), colored to match the corner boost badge, when originalOdds is set', () => {
    const boostedMarket: Market = {
      ...matchResult,
      selections: [
        { id: 'home', name: 'Home', odds: 2.5, originalOdds: 2.1 },
        ...matchResult.selections.slice(1),
      ],
    };
    renderWithQueryClient(
      <MarketSelections
        matchId="match-1"
        matchLabel="Arsenal vs Chelsea"
        competition={COMPETITION}
        market={boostedMarket}
      />,
    );

    // The struck-through previous price is what the dedicated
    // BoostedOddsRow block (Boosts page / match-detail Boosts section)
    // still shows - a regular market row stays visually consistent with
    // its non-boosted neighbors instead, showing just the one price.
    const homeButton = screen.getByRole('button', { name: /Home boosted to 2.50, was 2.10/ });
    expect(homeButton.querySelector('svg')).toBeInTheDocument();
    expect(screen.queryByText('2.10')).not.toBeInTheDocument();
    const oddValue = screen.getByText('2.50');
    expect(oddValue).toHaveClass('odd-value', 'text-highlight');
    // Draw/Away have no originalOdds, so no boost badge or highlight color for them.
    const drawButton = screen.getByRole('button', { name: 'Draw3.40' });
    expect(drawButton.querySelector('svg')).not.toBeInTheDocument();
    expect(screen.getByText('3.40')).not.toHaveClass('text-highlight');
  });

  it('captures the boosted odds and originalOdds when a boosted selection is added to the bet slip', async () => {
    const boostedMarket: Market = {
      ...matchResult,
      selections: [
        { id: 'home', name: 'Home', odds: 2.5, originalOdds: 2.1 },
        ...matchResult.selections.slice(1),
      ],
    };
    renderWithQueryClient(
      <MarketSelections
        matchId="match-1"
        matchLabel="Arsenal vs Chelsea"
        competition={COMPETITION}
        market={boostedMarket}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Home boosted to 2.50, was 2.10/ }));

    expect(useBetSlipStore.getState().selections).toEqual([
      expect.objectContaining({ odds: 2.5, originalOdds: 2.1 }),
    ]);
  });

  describe('team-name captions on a match-result market', () => {
    it("shows the real team names/'Draw' in place of the generic label when both team labels are supplied", () => {
      renderWithQueryClient(
        <MarketSelections
          matchId="match-1"
          matchLabel="Arsenal vs Chelsea"
          competition={COMPETITION}
          market={matchResult}
          homeTeamLabel="Arsenal"
          awayTeamLabel="Chelsea"
        />,
      );

      expect(screen.getByRole('button', { name: 'Arsenal2.10' }).querySelector('.odd-team-label')).toHaveTextContent(
        'Arsenal',
      );
      expect(screen.getByRole('button', { name: 'Draw3.40' }).querySelector('.odd-team-label')).toHaveTextContent(
        'Draw',
      );
      expect(screen.getByRole('button', { name: 'Chelsea3.20' }).querySelector('.odd-team-label')).toHaveTextContent(
        'Chelsea',
      );
    });

    it('still captures the plain selection name (not the team name) as the bet slip pick, since the caption is purely visual', async () => {
      renderWithQueryClient(
        <MarketSelections
          matchId="match-1"
          matchLabel="Arsenal vs Chelsea"
          competition={COMPETITION}
          market={matchResult}
          homeTeamLabel="Arsenal"
          awayTeamLabel="Chelsea"
        />,
      );

      await userEvent.click(screen.getByRole('button', { name: 'Arsenal2.10' }));

      expect(useBetSlipStore.getState().selections).toEqual([
        expect.objectContaining({ selectionName: 'Home' }),
      ]);
    });

    it('falls back to the plain generic label when team labels are not supplied', () => {
      renderMarketSelections();

      const homeButton = screen.getByRole('button', { name: 'Home2.10' });
      expect(homeButton.querySelector('.odd-team-label')).not.toBeInTheDocument();
      expect(homeButton.querySelector('.odd-label')).toHaveTextContent('Home');
    });

    it('does not caption a non-match-result market even when team labels are supplied', () => {
      const overUnder: Market = {
        id: 'over-under-2.5',
        name: 'Over/Under 2.5',
        selections: [
          { id: 'over', name: 'Over', odds: 1.9 },
          { id: 'under', name: 'Under', odds: 1.9 },
        ],
      };
      renderWithQueryClient(
        <MarketSelections
          matchId="match-1"
          matchLabel="Arsenal vs Chelsea"
          competition={COMPETITION}
          market={overUnder}
          homeTeamLabel="Arsenal"
          awayTeamLabel="Chelsea"
        />,
      );

      const overButton = screen.getByRole('button', { name: 'Over1.90' });
      expect(overButton.querySelector('.odd-team-label')).not.toBeInTheDocument();
      expect(overButton.querySelector('.odd-label')).toHaveTextContent('Over');
    });
  });
});
