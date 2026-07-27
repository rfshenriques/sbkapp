import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../auth/authStore';
import type { Freebet } from '../../lib/backendApi';
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

function renderDetector(queryClient: QueryClient) {
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return renderHook(() => useFreebetGrantDetector(), { wrapper });
}

beforeEach(() => {
  useAuthStore.setState({ accessToken: 'header.payload.signature', user: null, isInitialized: true });
  localStorage.clear();
});

afterEach(() => {
  useFreebetCreditedModalStore.setState({ grantId: null });
  vi.unstubAllGlobals();
});

describe('useFreebetGrantDetector', () => {
  it('does not open the modal for a grant that already existed long before the first load', async () => {
    const longAgo = new Date(Date.now() - 60 * 60_000).toISOString();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify([buildFreebet({ createdAt: longAgo })]), { status: 200 })),
    );
    const queryClient = new QueryClient();

    renderDetector(queryClient);

    await waitFor(() => expect(queryClient.getQueryData(freebetsQueryKey)).toBeDefined());
    expect(useFreebetCreditedModalStore.getState().grantId).toBeNull();
  });

  it('opens the modal for a grant credited moments before the very first load', async () => {
    const justNow = new Date().toISOString();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify([buildFreebet({ createdAt: justNow })]), { status: 200 })),
    );
    const queryClient = new QueryClient();

    renderDetector(queryClient);

    await waitFor(() => expect(useFreebetCreditedModalStore.getState().grantId).toBe('grant-1'));
  });

  it('opens the modal when a new campaign grant appears in a later poll', async () => {
    let grants: Freebet[] = [];
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify(grants), { status: 200 })));
    const queryClient = new QueryClient();

    renderDetector(queryClient);
    await waitFor(() => expect(queryClient.getQueryData(freebetsQueryKey)).toBeDefined());
    expect(useFreebetCreditedModalStore.getState().grantId).toBeNull();

    grants = [buildFreebet()];
    await queryClient.invalidateQueries({ queryKey: freebetsQueryKey });
    await waitFor(() => expect(useFreebetCreditedModalStore.getState().grantId).toBe('grant-1'));
  });

  it('ignores MANUAL/ACCA_ROLLBACK/INSURANCE_BET grants - they have no campaign to show', async () => {
    const justNow = new Date().toISOString();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([
            buildFreebet({ source: 'MANUAL', sourceCampaignId: null, campaignName: null, createdAt: justNow }),
          ]),
          { status: 200 },
        ),
      ),
    );
    const queryClient = new QueryClient();

    renderDetector(queryClient);

    await waitFor(() => expect(queryClient.getQueryData(freebetsQueryKey)).toBeDefined());
    expect(useFreebetCreditedModalStore.getState().grantId).toBeNull();
  });

  it('does not re-open the modal for a grant already recorded as credited', async () => {
    localStorage.setItem('sbkapp:credited-freebet-grant-ids', JSON.stringify(['grant-1']));
    const justNow = new Date().toISOString();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify([buildFreebet({ createdAt: justNow })]), { status: 200 })),
    );
    const queryClient = new QueryClient();

    renderDetector(queryClient);

    await waitFor(() => expect(queryClient.getQueryData(freebetsQueryKey)).toBeDefined());
    expect(useFreebetCreditedModalStore.getState().grantId).toBeNull();
  });

  it('does not permanently mark a grant credited until the modal is actually dismissed', async () => {
    const justNow = new Date().toISOString();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify([buildFreebet({ createdAt: justNow })]), { status: 200 })),
    );
    const queryClient = new QueryClient();

    renderDetector(queryClient);

    await waitFor(() => expect(useFreebetCreditedModalStore.getState().grantId).toBe('grant-1'));
    expect(JSON.parse(localStorage.getItem('sbkapp:credited-freebet-grant-ids') ?? '[]')).not.toContain('grant-1');
    expect(localStorage.getItem('sbkapp:pending-freebet-grant-id')).toBe('grant-1');
  });

  it('resumes an interrupted modal on the next mount, regardless of how long ago the grant was credited', async () => {
    const longAgo = new Date(Date.now() - 60 * 60_000).toISOString();
    localStorage.setItem('sbkapp:pending-freebet-grant-id', 'grant-1');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify([buildFreebet({ createdAt: longAgo })]), { status: 200 })),
    );
    const queryClient = new QueryClient();

    renderDetector(queryClient);

    await waitFor(() => expect(useFreebetCreditedModalStore.getState().grantId).toBe('grant-1'));

    useFreebetCreditedModalStore.setState({ grantId: null });
    await waitFor(() => expect(localStorage.getItem('sbkapp:pending-freebet-grant-id')).toBeNull());
    expect(JSON.parse(localStorage.getItem('sbkapp:credited-freebet-grant-ids') ?? '[]')).toContain('grant-1');
  });

  it('shows two grants in the same poll one after another as each modal is dismissed', async () => {
    let grants: Freebet[] = [];
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify(grants), { status: 200 })));
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
