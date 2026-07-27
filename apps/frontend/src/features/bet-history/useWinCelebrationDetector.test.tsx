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
    depositCampaignName: null,
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
});
