import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../auth/authStore';
import { DepositModal } from './DepositModal';
import { useDepositModalStore } from './depositModalStore';

function renderModal() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <DepositModal />
    </QueryClientProvider>,
  );
}

function stubFetch(handler: (url: string) => Response | undefined) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      return handler(url) ?? new Response(null, { status: 404 });
    }),
  );
}

beforeEach(() => {
  useDepositModalStore.setState({ isOpen: true });
  useAuthStore.setState({ accessToken: 'header.payload.signature', user: null, isInitialized: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DepositModal', () => {
  it('shows a compact campaign card when the player has an eligible deposit campaign', async () => {
    stubFetch((url) => {
      if (url === '/backend/deposit-campaigns/eligible') {
        return new Response(
          JSON.stringify({
            id: 'deposit-campaign-1',
            name: 'First Deposit Bonus',
            description: null,
            minDepositAmountCents: 1_000,
            rewardType: 'FIXED',
            fixedRewardAmountCents: 500,
            rewardPercent: null,
            rewardCapCents: null,
          }),
          { status: 200 },
        );
      }
      return undefined;
    });

    renderModal();

    expect(await screen.findByText('First Deposit Bonus')).toBeInTheDocument();
    expect(screen.getByText(/5\.00 €/)).toBeInTheDocument();
  });

  it('shows no campaign card when the player has no eligible deposit campaign', async () => {
    stubFetch((url) => {
      if (url === '/backend/deposit-campaigns/eligible') {
        return new Response(JSON.stringify(null), { status: 200 });
      }
      return undefined;
    });

    renderModal();

    await screen.findByText('Add funds');
    expect(screen.queryByText('First Deposit Bonus')).not.toBeInTheDocument();
  });
});
