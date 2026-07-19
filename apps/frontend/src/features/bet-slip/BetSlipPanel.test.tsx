import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../auth/authStore';
import { BetSlipPanel, type BetSlipPanelProps } from './BetSlipPanel';
import { useBetSlipStore } from './betSlipStore';

function renderPanel(props: BetSlipPanelProps = {}) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <BetSlipPanel {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

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
  useAuthStore.setState({ accessToken: null, user: null, isInitialized: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('BetSlipPanel', () => {
  it('shows an empty state when there are no selections', () => {
    renderPanel();

    expect(screen.getByText('Your bet slip is empty.')).toBeInTheDocument();
  });

  it('lists every selection with its combined odds', () => {
    useBetSlipStore.setState({ selections: [homeSelection, awaySelection] });
    renderPanel();

    expect(screen.getByText('Arsenal vs Chelsea')).toBeInTheDocument();
    expect(screen.getByText('Match Result: Home')).toBeInTheDocument();
    expect(screen.getByText('Liverpool vs Manchester City')).toBeInTheDocument();

    // combined odds = 2.1 * 2.5 = 5.25
    expect(screen.getByText('5.25')).toBeInTheDocument();
  });

  it('removes a selection when its remove button is clicked', async () => {
    useBetSlipStore.setState({ selections: [homeSelection, awaySelection] });
    renderPanel();

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove Home for Arsenal vs Chelsea' }),
    );

    expect(useBetSlipStore.getState().selections).toEqual([awaySelection]);
  });

  it('clears every selection when Clear is clicked', async () => {
    useBetSlipStore.setState({ selections: [homeSelection, awaySelection] });
    renderPanel();

    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(useBetSlipStore.getState().selections).toEqual([]);
  });

  it('disables the Place Bet button when logged out', () => {
    useBetSlipStore.setState({ selections: [homeSelection] });
    renderPanel();

    expect(screen.getByRole('button', { name: 'Place Bet' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument();
  });

  it('places a bet, shows a confirmation, and clears the slip when logged in', async () => {
    useAuthStore.setState({
      accessToken: 'header.payload.signature',
      user: null,
      isInitialized: true,
    });
    useBetSlipStore.setState({ selections: [homeSelection, awaySelection] });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'bet-1',
          stakeCents: 1000,
          combinedOdds: '5.25',
          potentialPayoutCents: 5250,
          status: 'PENDING',
          createdAt: '2026-07-17T00:00:00Z',
        }),
        { status: 201 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    renderPanel();

    const stakeInput = screen.getByLabelText('Stake');
    await userEvent.clear(stakeInput);
    await userEvent.type(stakeInput, '10');
    await userEvent.click(screen.getByRole('button', { name: 'Place Bet' }));

    expect(
      await screen.findByText(/Bet placed! Stake 10.00, potential payout 52.50/),
    ).toBeInTheDocument();
    expect(useBetSlipStore.getState().selections).toEqual([]);

    const [url, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/backend/bets');
    expect(JSON.parse(requestInit.body as string)).toEqual({
      selections: [homeSelection, awaySelection],
      stakeCents: 1000,
    });
  });

  it('shows no tabs and no combined odds for a single selection', () => {
    useBetSlipStore.setState({ selections: [homeSelection] });
    renderPanel();

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByText('Combined odds')).not.toBeInTheDocument();
    // Just the one selection's own odds, shown once.
    expect(screen.getByText('2.10')).toBeInTheDocument();
  });

  it('defaults to the Accumulator tab once there are 2+ selections', () => {
    useBetSlipStore.setState({ selections: [homeSelection, awaySelection] });
    renderPanel();

    expect(screen.getByRole('tab', { name: 'Accumulator' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Singles' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByText('Combined odds')).toBeInTheDocument();
  });

  it('switches to Accumulator when a second selection is added while already mounted (desktop persistent panel)', async () => {
    // No remount involved here (unlike the mobile drawer, which remounts on
    // every open) - this is the scenario a persistently-mounted desktop
    // panel actually hits.
    useBetSlipStore.setState({ selections: [homeSelection] });
    renderPanel();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();

    useBetSlipStore.setState({ selections: [homeSelection, awaySelection] });

    expect(await screen.findByRole('tab', { name: 'Accumulator' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('does not force Accumulator back on if the user manually switched to Singles', async () => {
    useBetSlipStore.setState({ selections: [homeSelection, awaySelection] });
    renderPanel();
    await userEvent.click(screen.getByRole('tab', { name: 'Singles' }));

    // Adding a third selection shouldn't yank the user back to Accumulator.
    useBetSlipStore.setState({
      selections: [homeSelection, awaySelection, { ...homeSelection, matchId: 'match-3' }],
    });

    expect(await screen.findByRole('tab', { name: 'Singles' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('switching to Singles shows each selection with its own stake and Place Bet button', async () => {
    useAuthStore.setState({ accessToken: 'header.payload.signature', user: null, isInitialized: true });
    useBetSlipStore.setState({ selections: [homeSelection, awaySelection] });
    renderPanel();

    await userEvent.click(screen.getByRole('tab', { name: 'Singles' }));

    expect(screen.queryByText('Combined odds')).not.toBeInTheDocument();
    const stakeInputs = screen.getAllByLabelText('Stake');
    expect(stakeInputs).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Place Bet' })).toHaveLength(2);
  });

  it('placing one single bet only removes that selection, not the whole slip', async () => {
    useAuthStore.setState({ accessToken: 'header.payload.signature', user: null, isInitialized: true });
    useBetSlipStore.setState({ selections: [homeSelection, awaySelection] });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'bet-1',
          stakeCents: 1000,
          combinedOdds: '2.10',
          potentialPayoutCents: 2100,
          status: 'PENDING',
          createdAt: '2026-07-17T00:00:00Z',
        }),
        { status: 201 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    renderPanel();
    await userEvent.click(screen.getByRole('tab', { name: 'Singles' }));

    const [placeBetButtons] = [screen.getAllByRole('button', { name: 'Place Bet' })];
    await userEvent.click(placeBetButtons[0] as HTMLElement);

    await screen.findByText(/Bet placed!/);
    expect(useBetSlipStore.getState().selections).toEqual([awaySelection]);

    const [url, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/backend/bets');
    expect(JSON.parse(requestInit.body as string).selections).toEqual([homeSelection]);
  });

  it('does not show a History tab by default (mobile drawer)', () => {
    renderPanel();

    expect(screen.queryByRole('tab', { name: 'History' })).not.toBeInTheDocument();
  });

  it('shows a Bet Slip / History tab pair when showHistoryTab is set (desktop)', async () => {
    useAuthStore.setState({ accessToken: 'header.payload.signature', user: null, isInitialized: true });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 })));
    renderPanel({ showHistoryTab: true });

    expect(screen.getByRole('tab', { name: 'Bet Slip' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Your bet slip is empty.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'History' }));

    expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText("You haven't placed any bets yet.")).toBeInTheDocument();
  });

  it('shows the compact empty state by default and the promotional one when requested', () => {
    const { unmount } = renderPanel();
    expect(screen.getByText('Your bet slip is empty.')).toBeInTheDocument();
    unmount();

    renderPanel({ emptyStateVariant: 'promotional' });
    expect(screen.getByText('Add selections to your bet slip')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse matches' })).toHaveAttribute('href', '/');
  });
});
