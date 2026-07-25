import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStaffAuthStore } from '../features/auth/staffAuthStore';
import type { DepositCampaign } from '../lib/backendApi';
import DepositCampaignsPage from './DepositCampaignsPage';

const draftCampaign: DepositCampaign = {
  id: 'campaign-1',
  brandId: 'brand-1',
  name: 'First Deposit Bonus',
  description: null,
  enabled: false,
  startAt: null,
  endAt: null,
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
  allowMultipleRedemptions: false,
  maxRedemptionsPerPlayer: null,
  audienceMode: 'ALL',
  segments: [],
  createdAt: '2026-07-24T00:00:00Z',
  updatedAt: '2026-07-24T00:00:00Z',
};

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <DepositCampaignsPage />
    </QueryClientProvider>,
  );
}

function stubFetch(handler: (url: string, method: string, init?: RequestInit) => Response | Promise<Response> | undefined) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method ?? 'GET';
    const result = await handler(url, method, init);
    if (result) return result;
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  useStaffAuthStore.setState({
    accessToken: 'header.payload.signature',
    user: { sub: 'staff-1', username: 'trading_alice', role: 'TRADING' },
    isInitialized: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DepositCampaignsPage', () => {
  it('lists campaigns collapsed by default, showing Draft/Live status', async () => {
    stubFetch((url) => {
      if (url === '/backend/admin/deposit-campaigns') {
        return new Response(JSON.stringify([draftCampaign]), { status: 200 });
      }
      return undefined;
    });

    renderPage();

    expect(await screen.findByText('First Deposit Bonus')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save details' })).not.toBeInTheDocument();
  });

  it('creating a new campaign posts its name, minimum deposit, and reward type', async () => {
    const fetchMock = stubFetch((url, method, init) => {
      if (method === 'GET' && url === '/backend/admin/deposit-campaigns') {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (method === 'POST' && url === '/backend/admin/deposit-campaigns') {
        expect(JSON.parse(init!.body as string)).toEqual({
          name: 'New Deposit Promo',
          minDepositAmountCents: 1000,
          rewardType: 'FIXED',
          fixedRewardAmountCents: 500,
        });
        return new Response(JSON.stringify({ ...draftCampaign, id: 'campaign-2', name: 'New Deposit Promo' }), {
          status: 200,
        });
      }
      return undefined;
    });

    renderPage();
    await screen.findByText('No campaigns yet - create one above.');

    await userEvent.type(screen.getByLabelText('Campaign name'), 'New Deposit Promo');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/deposit-campaigns',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('switching to percentage reward posts percent and cap instead of a fixed amount', async () => {
    const fetchMock = stubFetch((url, method, init) => {
      if (method === 'GET' && url === '/backend/admin/deposit-campaigns') {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (method === 'POST' && url === '/backend/admin/deposit-campaigns') {
        expect(JSON.parse(init!.body as string)).toEqual({
          name: 'Percent Promo',
          minDepositAmountCents: 1000,
          rewardType: 'PERCENTAGE',
          rewardPercent: 10,
          rewardCapCents: 5000,
        });
        return new Response(JSON.stringify({ ...draftCampaign, id: 'campaign-3', name: 'Percent Promo' }), {
          status: 200,
        });
      }
      return undefined;
    });

    renderPage();
    await screen.findByText('No campaigns yet - create one above.');

    await userEvent.type(screen.getByLabelText('Campaign name'), 'Percent Promo');
    await userEvent.selectOptions(screen.getByLabelText('Reward type'), 'PERCENTAGE');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/deposit-campaigns',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('disables Create when the reward amount is cleared', async () => {
    stubFetch((url, method) => {
      if (method === 'GET' && url === '/backend/admin/deposit-campaigns') {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return undefined;
    });

    renderPage();
    await screen.findByText('No campaigns yet - create one above.');

    await userEvent.type(screen.getByLabelText('Campaign name'), 'Incomplete Promo');
    await userEvent.clear(screen.getByLabelText('Reward amount'));

    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
  });

  it('toggling enabled sends a PATCH with the flipped value', async () => {
    const fetchMock = stubFetch((url, method, init) => {
      if (method === 'GET' && url === '/backend/admin/deposit-campaigns') {
        return new Response(JSON.stringify([draftCampaign]), { status: 200 });
      }
      if (method === 'PATCH' && url === '/backend/admin/deposit-campaigns/campaign-1') {
        expect(JSON.parse(init!.body as string)).toMatchObject({ enabled: true });
        return new Response(JSON.stringify({ ...draftCampaign, enabled: true }), { status: 200 });
      }
      return undefined;
    });

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /First Deposit Bonus/ }));
    await userEvent.click(screen.getByLabelText(/Enabled/));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/deposit-campaigns/campaign-1',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('deleting a campaign sends a DELETE for its id', async () => {
    const fetchMock = stubFetch((url, method) => {
      if (method === 'GET' && url === '/backend/admin/deposit-campaigns') {
        return new Response(JSON.stringify([draftCampaign]), { status: 200 });
      }
      if (method === 'DELETE' && url === '/backend/admin/deposit-campaigns/campaign-1') {
        return new Response(null, { status: 204 });
      }
      return undefined;
    });

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /First Deposit Bonus/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete campaign' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/deposit-campaigns/campaign-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('checking "requires a qualifying bet" reveals trigger fields, and saving includes them', async () => {
    const fetchMock = stubFetch((url, method, init) => {
      if (method === 'GET' && url === '/backend/admin/deposit-campaigns') {
        return new Response(JSON.stringify([draftCampaign]), { status: 200 });
      }
      if (method === 'PATCH' && url === '/backend/admin/deposit-campaigns/campaign-1') {
        const body = JSON.parse(init!.body as string);
        expect(body.requiresBet).toBe(true);
        expect(body.triggerOnWon).toBe(true);
        return new Response(JSON.stringify({ ...draftCampaign, requiresBet: true, triggerOnWon: true }), {
          status: 200,
        });
      }
      return undefined;
    });

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /First Deposit Bonus/ }));

    expect(screen.queryByText('Trigger')).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText(/Requires a qualifying bet/));
    expect(screen.getByText('Trigger')).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Settlement', { exact: false }));
    await userEvent.click(screen.getByLabelText('Won'));
    await userEvent.click(screen.getByRole('button', { name: 'Save details' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/deposit-campaigns/campaign-1',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('choosing "Specific player segments" audience loads and shows segments to pick', async () => {
    stubFetch((url, method) => {
      if (method === 'GET' && url === '/backend/admin/deposit-campaigns') {
        return new Response(JSON.stringify([draftCampaign]), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/admin/player-segments') {
        return new Response(
          JSON.stringify([
            { id: 'seg-1', brandId: 'brand-1', name: 'VIPs', description: null, colorHex: null, createdAt: '', updatedAt: '', members: [] },
          ]),
          { status: 200 },
        );
      }
      return undefined;
    });

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /First Deposit Bonus/ }));

    await userEvent.selectOptions(screen.getByLabelText(/^audience campaign-1$/), 'SEGMENTS');

    expect(await screen.findByText('VIPs')).toBeInTheDocument();
  });
});
