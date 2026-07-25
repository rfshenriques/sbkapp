import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../auth/authStore';
import type { DepositCampaign } from '../../lib/backendApi';
import { DepositCampaignModal } from './DepositCampaignModal';
import { useDepositCampaignModalStore } from './depositCampaignModalStore';

const fixedCampaign: DepositCampaign = {
  id: 'deposit-campaign-1',
  name: 'First Deposit Bonus',
  description: 'Top up and get a freebet.',
  minDepositAmountCents: 1_000,
  rewardType: 'FIXED',
  fixedRewardAmountCents: 500,
  rewardPercent: null,
  rewardCapCents: null,
  requiresBet: false,
  trigger: 'PLACEMENT',
  triggerOnWon: false,
  triggerOnLost: false,
  triggerOnVoid: false,
  minStakeCents: null,
  minOddsPerLeg: null,
  betType: 'EITHER',
  minSelections: null,
};

const requiresBetCampaign: DepositCampaign = {
  ...fixedCampaign,
  id: 'deposit-campaign-2',
  requiresBet: true,
  trigger: 'SETTLEMENT',
  triggerOnWon: true,
  minStakeCents: 500,
};

function renderModal() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <DepositCampaignModal />
    </QueryClientProvider>,
  );
}

function stubFetch(handler: (url: string, method: string, init?: RequestInit) => Response | undefined) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method ?? 'GET';
    const result = handler(url, method, init);
    if (result) return result;
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  useAuthStore.setState({ accessToken: 'header.payload.signature', user: null, isInitialized: true });
});

afterEach(() => {
  useDepositCampaignModalStore.setState({ campaign: null });
  vi.unstubAllGlobals();
});

describe('DepositCampaignModal', () => {
  it('renders nothing when no campaign is set', () => {
    renderModal();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('shows the fixed-reward explanation and a prefilled deposit amount', () => {
    useDepositCampaignModalStore.setState({ campaign: fixedCampaign });
    renderModal();

    expect(screen.getByText('First Deposit Bonus')).toBeInTheDocument();
    expect(screen.getByText('Deposit £10.00 or more and get a £5.00 freebet.')).toBeInTheDocument();
    expect(screen.getByLabelText('Deposit amount (£)')).toHaveValue('10.00');
  });

  it('shows bet requirements when the campaign requires a qualifying bet', () => {
    useDepositCampaignModalStore.setState({ campaign: requiresBetCampaign });
    renderModal();

    expect(screen.getByText(/Freebet credited once your qualifying bet wins/)).toBeInTheDocument();
    expect(screen.getByText('Min stake €5.00')).toBeInTheDocument();
  });

  it('submits the deposit and shows a granted-reward confirmation', async () => {
    useDepositCampaignModalStore.setState({ campaign: fixedCampaign });
    stubFetch((url, method) => {
      if (method === 'POST' && url === '/backend/deposits') {
        return new Response(
          JSON.stringify({
            deposit: { id: 'dep-1', amountCents: 1_000 },
            redemption: { id: 'red-1', rewardAmountCents: 500, status: 'GRANTED' },
          }),
          { status: 200 },
        );
      }
      return undefined;
    });

    renderModal();
    await userEvent.click(screen.getByRole('button', { name: 'Deposit' }));

    expect(
      await screen.findByText('Deposit successful! A £5.00 freebet has been added to your account.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
  });

  it('closes the modal when "Maybe later" is clicked', async () => {
    useDepositCampaignModalStore.setState({ campaign: fixedCampaign });
    renderModal();

    await userEvent.click(screen.getByRole('button', { name: 'Maybe later' }));

    expect(useDepositCampaignModalStore.getState().campaign).toBeNull();
  });
});
