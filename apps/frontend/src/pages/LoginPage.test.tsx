import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../features/auth/authStore';
import { useAuthModalStore } from '../features/auth/authModalStore';
import { useDepositCampaignModalStore } from '../features/deposit-campaigns/depositCampaignModalStore';
import LoginPage from './LoginPage';

function renderLoginPage() {
  return render(<LoginPage />);
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

beforeEach(() => {
  useAuthStore.setState({ accessToken: null, user: null, isInitialized: false });
  useAuthModalStore.setState({ mode: 'login' });
  useDepositCampaignModalStore.setState({ campaign: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LoginPage', () => {
  it('closes the modal when the backdrop is clicked', async () => {
    renderLoginPage();

    await userEvent.click(screen.getAllByRole('button', { name: 'Close login' })[0] as HTMLElement);

    expect(useAuthModalStore.getState().mode).toBeNull();
  });

  it('logs in and closes the modal on success', async () => {
    stubFetch((url) => {
      if (url === '/backend/auth/login') {
        return new Response(JSON.stringify({ accessToken: 'header.payload.signature' }), { status: 200 });
      }
      if (url === '/backend/deposit-campaigns/eligible') {
        return new Response(JSON.stringify(null), { status: 200 });
      }
      return undefined;
    });

    renderLoginPage();

    await userEvent.type(screen.getByLabelText('Email or username'), 'someone');
    await userEvent.type(screen.getByLabelText('Password'), 'correct-horse-battery-staple');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    await vi.waitFor(() => expect(useAuthModalStore.getState().mode).toBeNull());
    expect(useAuthStore.getState().accessToken).toBe('header.payload.signature');
  });

  it('opens the deposit campaign modal after login when the player is eligible for one', async () => {
    stubFetch((url) => {
      if (url === '/backend/auth/login') {
        return new Response(JSON.stringify({ accessToken: 'header.payload.signature' }), { status: 200 });
      }
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
            requiresBet: false,
            trigger: 'PLACEMENT',
            triggerOnWon: false,
            triggerOnLost: false,
            triggerOnVoid: false,
            minStakeCents: null,
            minOddsPerLeg: null,
            betType: 'EITHER',
            minSelections: null,
          }),
          { status: 200 },
        );
      }
      return undefined;
    });

    renderLoginPage();

    await userEvent.type(screen.getByLabelText('Email or username'), 'someone');
    await userEvent.type(screen.getByLabelText('Password'), 'correct-horse-battery-staple');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    await vi.waitFor(() => expect(useDepositCampaignModalStore.getState().campaign?.id).toBe('deposit-campaign-1'));
  });

  it('shows the server error message when login fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ message: 'Invalid credentials' }), { status: 401 }),
        ),
    );

    renderLoginPage();

    await userEvent.type(screen.getByLabelText('Email or username'), 'someone');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('switches to the register modal when "Register" is clicked', async () => {
    renderLoginPage();

    await userEvent.click(screen.getByRole('button', { name: 'Register' }));

    expect(useAuthModalStore.getState().mode).toBe('register');
  });
});
