import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../auth/authStore';
import type { PlacedBet } from '../../lib/backendApi';
import { betsQueryKey } from './useBets';
import { useWinCelebrationDetector } from './useWinCelebrationDetector';
import { useWinCelebrationStore } from './winCelebrationStore';

function buildBet(overrides: Partial<PlacedBet> = {}): PlacedBet {
  return {
    id: 'bet-1',
    stakeCents: 1000,
    combinedOdds: '2.00',
    potentialPayoutCents: 2000,
    status: 'PENDING',
    settledPayoutCents: null,
    settledAt: null,
    createdAt: '2026-07-19T10:00:00Z',
    fundedByFreebets: false,
    insuranceCostPercent: 0,
    accaBoostPercent: 0,
    betAndGetCampaignName: null,
    betAndGetCampaignRewardCents: null,
    depositCampaignName: null,
    depositCampaignRewardCents: null,
    accaRollbackRewardCents: null,
    selections: [
      {
        id: 'sel-1',
        matchId: 'match-1',
        marketId: 'match-result',
        selectionId: 'home',
        matchLabel: 'Arsenal vs Chelsea',
        marketName: 'Match Result',
        selectionName: 'Home',
        odds: '2.00',
        status: 'OPEN',
      },
    ],
    ...overrides,
  };
}

function renderDetector(queryClient: QueryClient) {
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return renderHook(() => useWinCelebrationDetector(), { wrapper });
}

beforeEach(() => {
  useAuthStore.setState({ accessToken: 'header.payload.signature', user: null, isInitialized: true });
  localStorage.clear();
});

afterEach(() => {
  useWinCelebrationStore.setState({ betId: null });
  vi.unstubAllGlobals();
});

describe('useWinCelebrationDetector', () => {
  it('does not celebrate a bet that is already WON on first load', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify([buildBet({ status: 'WON' })]), { status: 200 })),
    );
    const queryClient = new QueryClient();

    renderDetector(queryClient);

    await waitFor(() => expect(queryClient.getQueryData(betsQueryKey)).toBeDefined());
    expect(useWinCelebrationStore.getState().betId).toBeNull();
  });

  it('opens the celebration modal when a bet flips from PENDING to WON', async () => {
    let status: 'PENDING' | 'WON' = 'PENDING';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () =>
        new Response(JSON.stringify([buildBet({ status, settledPayoutCents: status === 'WON' ? 2000 : null })]), {
          status: 200,
        }),
      ),
    );
    const queryClient = new QueryClient();

    renderDetector(queryClient);
    await waitFor(() => expect(queryClient.getQueryData(betsQueryKey)).toBeDefined());
    expect(useWinCelebrationStore.getState().betId).toBeNull();

    status = 'WON';
    await queryClient.invalidateQueries({ queryKey: betsQueryKey });
    await waitFor(() => expect(useWinCelebrationStore.getState().betId).toBe('bet-1'));
  });

  it('celebrates a bet that settled to WON moments before the very first load', async () => {
    const justNow = new Date().toISOString();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([buildBet({ status: 'WON', settledPayoutCents: 2000, settledAt: justNow })]),
          { status: 200 },
        ),
      ),
    );
    const queryClient = new QueryClient();

    renderDetector(queryClient);

    await waitFor(() => expect(useWinCelebrationStore.getState().betId).toBe('bet-1'));
  });

  it('does not celebrate a bet that was already WON long before the first load', async () => {
    const longAgo = new Date(Date.now() - 60 * 60_000).toISOString();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([buildBet({ status: 'WON', settledPayoutCents: 2000, settledAt: longAgo })]),
          { status: 200 },
        ),
      ),
    );
    const queryClient = new QueryClient();

    renderDetector(queryClient);

    await waitFor(() => expect(queryClient.getQueryData(betsQueryKey)).toBeDefined());
    expect(useWinCelebrationStore.getState().betId).toBeNull();
  });

  it('celebrates both bets in turn when two settle to WON in the same poll', async () => {
    let statusA: 'PENDING' | 'WON' = 'PENDING';
    let statusB: 'PENDING' | 'WON' = 'PENDING';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () =>
        new Response(
          JSON.stringify([
            buildBet({ id: 'bet-1', status: statusA, settledPayoutCents: statusA === 'WON' ? 2000 : null }),
            buildBet({ id: 'bet-2', status: statusB, settledPayoutCents: statusB === 'WON' ? 3000 : null }),
          ]),
          { status: 200 },
        ),
      ),
    );
    const queryClient = new QueryClient();

    renderDetector(queryClient);
    await waitFor(() => expect(queryClient.getQueryData(betsQueryKey)).toBeDefined());

    statusA = 'WON';
    statusB = 'WON';
    await queryClient.invalidateQueries({ queryKey: betsQueryKey });
    await waitFor(() => expect(useWinCelebrationStore.getState().betId).toBe('bet-1'));

    useWinCelebrationStore.setState({ betId: null });
    await queryClient.invalidateQueries({ queryKey: betsQueryKey });
    await waitFor(() => expect(useWinCelebrationStore.getState().betId).toBe('bet-2'));
  });

  it('does not re-celebrate a bet already recorded as celebrated', async () => {
    localStorage.setItem('sbkapp:celebrated-bet-ids', JSON.stringify(['bet-1']));
    let status: 'PENDING' | 'WON' = 'PENDING';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () =>
        new Response(JSON.stringify([buildBet({ status, settledPayoutCents: status === 'WON' ? 2000 : null })]), {
          status: 200,
        }),
      ),
    );
    const queryClient = new QueryClient();

    renderDetector(queryClient);
    await waitFor(() => expect(queryClient.getQueryData(betsQueryKey)).toBeDefined());

    status = 'WON';
    await queryClient.invalidateQueries({ queryKey: betsQueryKey });
    await waitFor(() => expect(queryClient.getQueryData<PlacedBet[]>(betsQueryKey)?.[0]?.status).toBe('WON'));

    expect(useWinCelebrationStore.getState().betId).toBeNull();
  });

  it('does not permanently mark a bet celebrated until the celebration is actually dismissed', async () => {
    let status: 'PENDING' | 'WON' = 'PENDING';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () =>
        new Response(JSON.stringify([buildBet({ status, settledPayoutCents: status === 'WON' ? 2000 : null })]), {
          status: 200,
        }),
      ),
    );
    const queryClient = new QueryClient();

    renderDetector(queryClient);
    await waitFor(() => expect(queryClient.getQueryData(betsQueryKey)).toBeDefined());

    status = 'WON';
    await queryClient.invalidateQueries({ queryKey: betsQueryKey });
    await waitFor(() => expect(useWinCelebrationStore.getState().betId).toBe('bet-1'));

    // The modal is open but hasn't been dismissed yet - a same-session
    // reload landing right here (e.g. the PWA auto-update's
    // window.location.reload()) must not have already burned this bet into
    // the permanent celebrated set, or the resumed celebration below would
    // never fire.
    expect(JSON.parse(localStorage.getItem('sbkapp:celebrated-bet-ids') ?? '[]')).not.toContain('bet-1');
    expect(localStorage.getItem('sbkapp:pending-celebration-bet-id')).toBe('bet-1');
  });

  it('resumes an interrupted celebration on the next mount, regardless of how long ago the bet settled', async () => {
    // Simulates a same-session reload (e.g. the PWA auto-update's
    // window.location.reload() firing right after the app is foregrounded -
    // see registerType: 'autoUpdate' in vite.config.ts) that lands between
    // this hook detecting a win and the player actually dismissing the
    // celebration for it: the pending marker survives (localStorage), the
    // in-memory zustand store does not (reset to betId: null on remount).
    const longAgo = new Date(Date.now() - 60 * 60_000).toISOString();
    localStorage.setItem('sbkapp:pending-celebration-bet-id', 'bet-1');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([buildBet({ status: 'WON', settledPayoutCents: 2000, settledAt: longAgo })]),
          { status: 200 },
        ),
      ),
    );
    const queryClient = new QueryClient();

    renderDetector(queryClient);

    await waitFor(() => expect(useWinCelebrationStore.getState().betId).toBe('bet-1'));

    // Dismissing it now finally burns it into the permanent set and clears the pending marker.
    useWinCelebrationStore.setState({ betId: null });
    await waitFor(() => expect(localStorage.getItem('sbkapp:pending-celebration-bet-id')).toBeNull());
    expect(JSON.parse(localStorage.getItem('sbkapp:celebrated-bet-ids') ?? '[]')).toContain('bet-1');
  });

  it('does not resume a pending celebration for a bet that was already recorded as celebrated', async () => {
    localStorage.setItem('sbkapp:pending-celebration-bet-id', 'bet-1');
    localStorage.setItem('sbkapp:celebrated-bet-ids', JSON.stringify(['bet-1']));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify([buildBet({ status: 'WON', settledPayoutCents: 2000 })]), { status: 200 }),
      ),
    );
    const queryClient = new QueryClient();

    renderDetector(queryClient);

    await waitFor(() => expect(queryClient.getQueryData(betsQueryKey)).toBeDefined());
    expect(useWinCelebrationStore.getState().betId).toBeNull();
  });
});
