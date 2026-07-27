import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../auth/authStore';
import type { Freebet } from '../../lib/backendApi';
import { FreebetCreditedModal } from './FreebetCreditedModal';
import { useFreebetCreditedModalStore } from './freebetCreditedModalStore';
import { useFreebetFlyStore } from './freebetFlyStore';

function buildFreebet(overrides: Partial<Freebet> = {}): Freebet {
  return {
    id: 'grant-1',
    amountCents: 1500,
    remainingCents: 1500,
    expiresAt: null,
    createdAt: '2026-07-27T10:00:00Z',
    source: 'BET_AND_GET',
    sourceCampaignId: 'campaign-1',
    campaignName: 'Weekend Boost',
    ...overrides,
  };
}

function renderModal() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <FreebetCreditedModal />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useAuthStore.setState({ accessToken: 'header.payload.signature', user: null, isInitialized: true });
});

afterEach(() => {
  useFreebetCreditedModalStore.setState({ grantId: null });
  useFreebetFlyStore.setState({ active: false, fromCents: 0, toCents: 0, targetId: '' });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('FreebetCreditedModal', () => {
  it('renders nothing when no grant is selected', () => {
    renderModal();
    expect(screen.queryByText('in Freebets')).not.toBeInTheDocument();
  });

  it('shows the credited amount and campaign name for a BET_AND_GET grant', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([buildFreebet()]), { status: 200 })));
    useFreebetCreditedModalStore.setState({ grantId: 'grant-1' });

    renderModal();

    expect(await screen.findByText('15.00 €')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Weekend Boost' })).toBeInTheDocument();
    expect(screen.getByText(/credited freebets from the "Weekend Boost" campaign/)).toBeInTheDocument();
  });

  it('triggers the fly animation and closes when "Get my freebets" is clicked', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify([buildFreebet(), buildFreebet({ id: 'grant-existing', amountCents: 500, remainingCents: 500, source: 'MANUAL', sourceCampaignId: null, campaignName: null })]), {
          status: 200,
        }),
      ),
    );
    useFreebetCreditedModalStore.setState({ grantId: 'grant-1' });

    renderModal();
    await screen.findByText('15.00 €');
    await userEvent.click(screen.getByRole('button', { name: 'Get my freebets' }));

    expect(useFreebetCreditedModalStore.getState().grantId).toBeNull();
    const flyState = useFreebetFlyStore.getState();
    expect(flyState.active).toBe(true);
    // Total balance is 1500 + 500 = 2000; this grant contributed 1500, so the
    // roll should start from the balance without it (500) and end at 2000.
    expect(flyState.fromCents).toBe(500);
    expect(flyState.toCents).toBe(2000);
  });
});
