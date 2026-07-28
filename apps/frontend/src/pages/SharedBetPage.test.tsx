import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../features/auth/authStore';
import { useAuthModalStore } from '../features/auth/authModalStore';
import { useBrandStore } from '../features/brand/brandStore';
import { useBetSlipSheetStore } from '../features/bet-slip/betSlipSheetStore';
import { useBetSlipStore } from '../features/bet-slip/betSlipStore';
import { encodeSharedBetSelections } from '../features/bet-slip/sharedBetLink';
import SharedBetPage from './SharedBetPage';

function renderPage(sel: string) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/shared-bet?sel=${encodeURIComponent(sel)}`]}>
        <SharedBetPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function stubFetch(handler: (url: string) => Response | undefined) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    const result = handler(url);
    if (result) return result;
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const match = {
  id: 'match-1',
  sport: 'Football',
  country: 'England',
  competition: 'Premier League',
  homeTeam: 'Arsenal',
  awayTeam: 'Chelsea',
  kickoff: '2026-08-01T15:00:00Z',
  isLive: false,
  markets: [
    {
      id: 'match-result',
      name: 'Match Result',
      selections: [
        { id: 'home', name: 'Home', odds: 2.1 },
        { id: 'away', name: 'Away', odds: 3.4 },
      ],
    },
  ],
};

beforeEach(() => {
  useAuthStore.setState({ accessToken: 'header.payload.signature', user: null, isInitialized: true });
  useAuthModalStore.setState({ mode: null });
  useBrandStore.setState({ brandId: 'brand-1' });
  useBetSlipStore.setState({ selections: [], stake: '10.00', singleStakes: {} });
  useBetSlipSheetStore.setState({ isOpen: false });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SharedBetPage', () => {
  it('shows an invalid-link message for a malformed sel param', () => {
    stubFetch(() => new Response(JSON.stringify([]), { status: 200 }));

    renderPage('not-a-valid-ref');

    expect(screen.getByText("This bet link isn't valid")).toBeInTheDocument();
  });

  it('prompts to log in before resolving anything when the visitor is signed out', () => {
    useAuthStore.setState({ accessToken: null, user: null, isInitialized: true });
    stubFetch(() => new Response(JSON.stringify([]), { status: 200 }));

    renderPage(encodeSharedBetSelections([{ matchId: 'match-1', marketId: 'match-result', selectionId: 'home' }]));

    expect(useAuthModalStore.getState().mode).toBe('login');
    expect(screen.getByText('Log in to add this bet')).toBeInTheDocument();
  });

  it('resolves the selection against live match data and adds it to the bet slip', async () => {
    stubFetch((url) => {
      if (url === '/backend/public/matches/brand-1/match-1') {
        return new Response(JSON.stringify(match), { status: 200 });
      }
      if (url === '/backend/public/display-names') {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return undefined;
    });

    renderPage(encodeSharedBetSelections([{ matchId: 'match-1', marketId: 'match-result', selectionId: 'home' }]));

    await waitFor(() => expect(useBetSlipSheetStore.getState().isOpen).toBe(true));
    expect(useBetSlipStore.getState().selections).toEqual([
      {
        matchId: 'match-1',
        marketId: 'match-result',
        selectionId: 'home',
        matchLabel: 'Arsenal vs Chelsea',
        marketName: 'Match Result',
        selectionName: 'Home',
        odds: 2.1,
        originalOdds: undefined,
        maxStakeCents: undefined,
        marketSinglesOnly: undefined,
      },
    ]);
  });

  it('skips a selection whose match/market/selection can no longer be found', async () => {
    stubFetch((url) => {
      if (url === '/backend/public/matches/brand-1/match-1') {
        return new Response(null, { status: 404 });
      }
      if (url === '/backend/public/display-names') {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return undefined;
    });

    renderPage(encodeSharedBetSelections([{ matchId: 'match-1', marketId: 'match-result', selectionId: 'home' }]));

    await waitFor(() => expect(useBetSlipSheetStore.getState().isOpen).toBe(true));
    expect(useBetSlipStore.getState().selections).toEqual([]);
  });
});
