import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoostedSelectionSummary } from '@sportsbook/shared';
import { useBetSlipStore } from '../features/bet-slip/betSlipStore';
import { useBrandStore } from '../features/brand/brandStore';
import BoostsPage from './BoostsPage';

const TEST_BRAND_ID = 'brand-1';

function buildBoostedSelection(overrides: Partial<BoostedSelectionSummary> = {}): BoostedSelectionSummary {
  return {
    matchId: 'm1',
    sport: 'Football',
    country: 'England',
    competition: 'Premier League',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    kickoff: '2026-07-19T18:00:00Z',
    isLive: false,
    marketId: 'match-result',
    marketName: 'Match Result',
    selectionId: 'home',
    selectionName: 'Home',
    previousOdds: 2.0,
    odds: 2.1,
    ...overrides,
  };
}

function stubFetch(items: BoostedSelectionSummary[]) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url === `/backend/public/boosts/${TEST_BRAND_ID}`) {
      return new Response(JSON.stringify(items), { status: 200 });
    }
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderBoostsPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <BoostsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useBrandStore.setState({ brandId: TEST_BRAND_ID });
  useBetSlipStore.setState({ selections: [] });
});

afterEach(() => {
  vi.unstubAllGlobals();
  useBrandStore.setState({ brandId: undefined });
});

describe('BoostsPage', () => {
  it('groups boosted selections by sport and shows previous/new price and max stake', async () => {
    stubFetch([buildBoostedSelection({ maxStakeCents: 10_000 })]);
    renderBoostsPage();

    expect(await screen.findByText('Football')).toBeInTheDocument();
    expect(screen.getByText('Arsenal vs Chelsea')).toBeInTheDocument();
    expect(screen.getByText('2.00')).toBeInTheDocument();
    expect(screen.getByText('2.10')).toBeInTheDocument();
    expect(screen.getByText(/Max stake for boosted price: €100.00/)).toBeInTheDocument();
  });

  it('clicking the boosted odds adds it to the bet slip', async () => {
    stubFetch([buildBoostedSelection()]);
    renderBoostsPage();

    const oddButton = await screen.findByRole('button', { name: /Home boosted to 2.10, was 2.00/ });
    await userEvent.click(oddButton);

    expect(useBetSlipStore.getState().selections).toEqual([
      expect.objectContaining({ matchId: 'm1', marketId: 'match-result', selectionId: 'home', odds: 2.1 }),
    ]);
  });

  it('shows an empty state when nothing is boosted', async () => {
    stubFetch([]);
    renderBoostsPage();

    expect(await screen.findByText('No boosted prices available right now.')).toBeInTheDocument();
  });
});
