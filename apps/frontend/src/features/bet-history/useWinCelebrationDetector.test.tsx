import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../auth/authStore';
import type { PlacedBet, UnseenCelebrations } from '../../lib/backendApi';
import { betsQueryKey } from './useBets';
import { useUnseenCelebrations } from './useUnseenCelebrations';
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

const EMPTY_UNSEEN: UnseenCelebrations = { wonBets: [], freebetGrants: [] };

/** Routes /bets and /unseen-celebrations to their own handlers - both are fetched by this hook. */
function stubFetch(options: {
  bets?: () => PlacedBet[];
  unseen?: () => UnseenCelebrations;
  onAck?: (body: { betIds: string[]; freebetGrantIds: string[] }) => void;
}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.endsWith('/unseen-celebrations/ack')) {
      options.onAck?.(JSON.parse(init?.body as string));
      return new Response(null, { status: 200 });
    }
    if (url.endsWith('/unseen-celebrations')) {
      return new Response(JSON.stringify(options.unseen?.() ?? EMPTY_UNSEEN), { status: 200 });
    }
    if (url.endsWith('/bets')) {
      return new Response(JSON.stringify(options.bets?.() ?? []), { status: 200 });
    }
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderDetector(queryClient: QueryClient) {
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return renderHook(() => useWinCelebrationDetector(), { wrapper });
}

beforeEach(() => {
  useAuthStore.setState({ accessToken: 'header.payload.signature', user: null, isInitialized: true });
});

afterEach(() => {
  useWinCelebrationStore.setState({ betId: null });
  vi.unstubAllGlobals();
});

describe('useWinCelebrationDetector', () => {
  it('does not celebrate a bet that is already WON on first load when it is not returned as unseen', async () => {
    const fetchMock = stubFetch({ bets: () => [buildBet({ status: 'WON' })] });
    const queryClient = new QueryClient();

    renderDetector(queryClient);

    await waitFor(() => expect(queryClient.getQueryData(betsQueryKey)).toBeDefined());
    expect(useWinCelebrationStore.getState().betId).toBeNull();
    expect(fetchMock).toHaveBeenCalled();
  });

  it('opens the celebration modal for a bet returned by unseen-celebrations on first load, regardless of settlement age', async () => {
    const longAgo = new Date(Date.now() - 60 * 60_000).toISOString();
    const wonBet = buildBet({ status: 'WON', settledPayoutCents: 2000, settledAt: longAgo });
    stubFetch({ bets: () => [wonBet], unseen: () => ({ wonBets: [wonBet], freebetGrants: [] }) });
    const queryClient = new QueryClient();

    renderDetector(queryClient);

    await waitFor(() => expect(useWinCelebrationStore.getState().betId).toBe('bet-1'));
  });

  it('opens the celebration modal when a bet flips from PENDING to WON during a live poll', async () => {
    let status: 'PENDING' | 'WON' = 'PENDING';
    stubFetch({ bets: () => [buildBet({ status, settledPayoutCents: status === 'WON' ? 2000 : null })] });
    const queryClient = new QueryClient();

    renderDetector(queryClient);
    await waitFor(() => expect(queryClient.getQueryData(betsQueryKey)).toBeDefined());
    expect(useWinCelebrationStore.getState().betId).toBeNull();

    status = 'WON';
    await queryClient.invalidateQueries({ queryKey: betsQueryKey });
    await waitFor(() => expect(useWinCelebrationStore.getState().betId).toBe('bet-1'));
  });

  it('celebrates a live transition and a backend-unseen bet in turn, without duplicating either', async () => {
    const unseenBet = buildBet({ id: 'bet-unseen', status: 'WON', settledPayoutCents: 2000 });
    let liveStatus: 'PENDING' | 'WON' = 'PENDING';
    stubFetch({
      bets: () => [
        unseenBet,
        buildBet({ id: 'bet-live', status: liveStatus, settledPayoutCents: liveStatus === 'WON' ? 3000 : null }),
      ],
      unseen: () => ({ wonBets: [unseenBet], freebetGrants: [] }),
    });
    const queryClient = new QueryClient();

    renderDetector(queryClient);
    await waitFor(() => expect(useWinCelebrationStore.getState().betId).toBe('bet-unseen'));

    liveStatus = 'WON';
    await queryClient.invalidateQueries({ queryKey: betsQueryKey });
    // Still showing the first celebration - the live transition is queued, not shown yet.
    expect(useWinCelebrationStore.getState().betId).toBe('bet-unseen');

    useWinCelebrationStore.setState({ betId: null });
    await waitFor(() => expect(useWinCelebrationStore.getState().betId).toBe('bet-live'));
  });

  it('acknowledges the bet via the backend only once the celebration is actually dismissed', async () => {
    const unseenBet = buildBet({ status: 'WON', settledPayoutCents: 2000 });
    const acked: Array<{ betIds: string[]; freebetGrantIds: string[] }> = [];
    stubFetch({
      bets: () => [unseenBet],
      unseen: () => ({ wonBets: [unseenBet], freebetGrants: [] }),
      onAck: (body) => acked.push(body),
    });
    const queryClient = new QueryClient();

    renderDetector(queryClient);
    await waitFor(() => expect(useWinCelebrationStore.getState().betId).toBe('bet-1'));

    // The modal is open but hasn't been dismissed yet.
    expect(acked).toHaveLength(0);

    useWinCelebrationStore.setState({ betId: null });
    await waitFor(() => expect(acked).toEqual([{ betIds: ['bet-1'], freebetGrantIds: [] }]));
  });

  it('is disabled (fetches nothing) while unauthenticated', () => {
    useAuthStore.setState({ accessToken: null, user: null, isInitialized: true });
    const fetchMock = stubFetch({});
    const queryClient = new QueryClient();

    const { result } = renderHook(() => useUnseenCelebrations(), {
      wrapper: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
