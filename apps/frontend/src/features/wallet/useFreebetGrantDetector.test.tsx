import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../auth/authStore';
import type { Freebet, UnseenCelebrations } from '../../lib/backendApi';
import { freebetsQueryKey } from './useFreebets';
import { useFreebetGrantDetector } from './useFreebetGrantDetector';
import { useFreebetCreditedModalStore } from './freebetCreditedModalStore';

function buildFreebet(overrides: Partial<Freebet> = {}): Freebet {
  return {
    id: 'grant-1',
    amountCents: 1000,
    remainingCents: 1000,
    expiresAt: null,
    createdAt: '2026-07-19T10:00:00Z',
    source: 'BET_AND_GET',
    sourceCampaignId: 'campaign-1',
    campaignName: 'Weekend Boost',
    ...overrides,
  };
}

const EMPTY_UNSEEN: UnseenCelebrations = { wonBets: [], freebetGrants: [] };

/** Routes /freebets and /unseen-celebrations to their own handlers - both are fetched by this hook. */
function stubFetch(options: {
  freebets?: () => Freebet[];
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
    if (url.endsWith('/freebets')) {
      return new Response(JSON.stringify(options.freebets?.() ?? []), { status: 200 });
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
  return renderHook(() => useFreebetGrantDetector(), { wrapper });
}

beforeEach(() => {
  useAuthStore.setState({ accessToken: 'header.payload.signature', user: null, isInitialized: true });
});

afterEach(() => {
  useFreebetCreditedModalStore.setState({ grantId: null });
  vi.unstubAllGlobals();
});

describe('useFreebetGrantDetector', () => {
  it('does not open the modal for an existing grant that is not returned as unseen', async () => {
    const fetchMock = stubFetch({ freebets: () => [buildFreebet()] });
    const queryClient = new QueryClient();

    renderDetector(queryClient);

    await waitFor(() => expect(queryClient.getQueryData(freebetsQueryKey)).toBeDefined());
    expect(useFreebetCreditedModalStore.getState().grantId).toBeNull();
    expect(fetchMock).toHaveBeenCalled();
  });

  it('opens the modal for a grant returned by unseen-celebrations on first load, regardless of age', async () => {
    const longAgo = new Date(Date.now() - 60 * 60_000).toISOString();
    const grant = buildFreebet({ createdAt: longAgo });
    stubFetch({ freebets: () => [grant], unseen: () => ({ wonBets: [], freebetGrants: [grant] }) });
    const queryClient = new QueryClient();

    renderDetector(queryClient);

    await waitFor(() => expect(useFreebetCreditedModalStore.getState().grantId).toBe('grant-1'));
  });

  it('opens the modal when a new campaign grant appears in a later poll', async () => {
    let grants: Freebet[] = [];
    stubFetch({ freebets: () => grants });
    const queryClient = new QueryClient();

    renderDetector(queryClient);
    await waitFor(() => expect(queryClient.getQueryData(freebetsQueryKey)).toBeDefined());
    expect(useFreebetCreditedModalStore.getState().grantId).toBeNull();

    grants = [buildFreebet()];
    await queryClient.invalidateQueries({ queryKey: freebetsQueryKey });
    await waitFor(() => expect(useFreebetCreditedModalStore.getState().grantId).toBe('grant-1'));
  });

  it('ignores MANUAL/ACCA_ROLLBACK/INSURANCE_BET grants on the live poll - they have no campaign to show', async () => {
    const manualGrant = buildFreebet({ source: 'MANUAL', sourceCampaignId: null, campaignName: null });
    stubFetch({ freebets: () => [manualGrant] });
    const queryClient = new QueryClient();

    renderDetector(queryClient);

    await waitFor(() => expect(queryClient.getQueryData(freebetsQueryKey)).toBeDefined());
    expect(useFreebetCreditedModalStore.getState().grantId).toBeNull();
  });

  it('acknowledges a non-campaign unseen grant immediately without ever opening the modal for it', async () => {
    const manualGrant = buildFreebet({ id: 'grant-manual', source: 'MANUAL', sourceCampaignId: null, campaignName: null });
    const acked: Array<{ betIds: string[]; freebetGrantIds: string[] }> = [];
    stubFetch({
      freebets: () => [manualGrant],
      unseen: () => ({ wonBets: [], freebetGrants: [manualGrant] }),
      onAck: (body) => acked.push(body),
    });
    const queryClient = new QueryClient();

    renderDetector(queryClient);

    await waitFor(() => expect(acked).toEqual([{ betIds: [], freebetGrantIds: ['grant-manual'] }]));
    expect(useFreebetCreditedModalStore.getState().grantId).toBeNull();
  });

  it('acknowledges a campaign grant via the backend only once the modal is actually dismissed', async () => {
    const grant = buildFreebet();
    const acked: Array<{ betIds: string[]; freebetGrantIds: string[] }> = [];
    stubFetch({
      freebets: () => [grant],
      unseen: () => ({ wonBets: [], freebetGrants: [grant] }),
      onAck: (body) => acked.push(body),
    });
    const queryClient = new QueryClient();

    renderDetector(queryClient);
    await waitFor(() => expect(useFreebetCreditedModalStore.getState().grantId).toBe('grant-1'));

    expect(acked).toHaveLength(0);

    useFreebetCreditedModalStore.setState({ grantId: null });
    await waitFor(() => expect(acked).toEqual([{ betIds: [], freebetGrantIds: ['grant-1'] }]));
  });

  it('shows two grants in the same poll one after another as each modal is dismissed', async () => {
    let grants: Freebet[] = [];
    stubFetch({ freebets: () => grants });
    const queryClient = new QueryClient();

    renderDetector(queryClient);
    await waitFor(() => expect(queryClient.getQueryData(freebetsQueryKey)).toBeDefined());

    grants = [buildFreebet({ id: 'grant-1' }), buildFreebet({ id: 'grant-2' })];
    await queryClient.invalidateQueries({ queryKey: freebetsQueryKey });
    await waitFor(() => expect(useFreebetCreditedModalStore.getState().grantId).toBe('grant-1'));

    useFreebetCreditedModalStore.setState({ grantId: null });
    await waitFor(() => expect(useFreebetCreditedModalStore.getState().grantId).toBe('grant-2'));
  });
});
