import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Match } from '@sportsbook/shared';
import { useBrandStore } from '../features/brand/brandStore';
import SpecialsPage from './SpecialsPage';

const TEST_BRAND_ID = 'brand-1';

function buildSpecialMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'm1',
    sport: 'Football',
    country: 'England',
    competition: 'Premier League',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    kickoff: '2026-07-19T18:00:00Z',
    isLive: false,
    markets: [
      {
        id: 'manual-1',
        name: 'Anytime Assist',
        isSpecial: true,
        selections: [
          { id: 'sel-1', name: 'Saka', odds: 3.5 },
          { id: 'sel-2', name: 'Odegaard', odds: 4.0 },
        ],
      },
    ],
    ...overrides,
  };
}

function stubFetch(matches: Match[]) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url === `/backend/public/specials/${TEST_BRAND_ID}`) {
      return new Response(JSON.stringify(matches), { status: 200 });
    }
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderSpecialsPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SpecialsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useBrandStore.setState({ brandId: TEST_BRAND_ID });
});

afterEach(() => {
  vi.unstubAllGlobals();
  useBrandStore.setState({ brandId: undefined });
});

describe('SpecialsPage', () => {
  it('groups matches by sport and lists each manual market with its selections', async () => {
    stubFetch([buildSpecialMatch()]);
    renderSpecialsPage();

    expect(await screen.findByText('Anytime Assist')).toBeInTheDocument();
    expect(screen.getByText('Football')).toBeInTheDocument();
    expect(screen.getByText('Arsenal vs Chelsea')).toBeInTheDocument();
    expect(screen.getByText('Saka')).toBeInTheDocument();
  });

  it('shows an empty state when there are no specials', async () => {
    stubFetch([]);
    renderSpecialsPage();

    expect(await screen.findByText('No specials available right now.')).toBeInTheDocument();
  });

  it("shows 'Singles only' alongside the max stake for a singles-only manual market", async () => {
    stubFetch([
      buildSpecialMatch({
        markets: [
          {
            id: 'manual-1',
            name: 'Anytime Assist',
            isSpecial: true,
            singlesOnly: true,
            maxStakeCents: 2_500,
            selections: [{ id: 'sel-1', name: 'Saka', odds: 3.5 }],
          },
        ],
      }),
    ]);
    renderSpecialsPage();

    expect(await screen.findByText('Max stake: €25.00 · Singles only')).toBeInTheDocument();
  });
});
