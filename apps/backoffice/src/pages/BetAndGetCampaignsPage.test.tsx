import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStaffAuthStore } from '../features/auth/staffAuthStore';
import type { BetAndGetCampaign } from '../lib/backendApi';
import BetAndGetCampaignsPage from './BetAndGetCampaignsPage';

const draftCampaign: BetAndGetCampaign = {
  id: 'campaign-1',
  brandId: 'brand-1',
  name: 'CL Bet & Get',
  description: null,
  enabled: false,
  startAt: null,
  endAt: null,
  rewardAmountCents: 1_000,
  trigger: 'PLACEMENT',
  triggerOnWon: false,
  triggerOnLost: false,
  triggerOnVoid: false,
  minStakeCents: null,
  minOddsPerLeg: null,
  minCombinedOdds: null,
  betType: 'EITHER',
  minSelections: null,
  allowMultipleRedemptions: false,
  maxRedemptionsPerPlayer: null,
  createdAt: '2026-07-24T00:00:00Z',
  updatedAt: '2026-07-24T00:00:00Z',
  scopes: [],
};

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <BetAndGetCampaignsPage />
    </QueryClientProvider>,
  );
}

function stubFetch(handler: (url: string, method: string, init?: RequestInit) => Response | Promise<Response> | undefined) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method ?? 'GET';
    const result = await handler(url, method, init);
    if (result) return result;
    if (url === '/api/events') {
      return new Response(JSON.stringify([]), { status: 200 });
    }
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

describe('BetAndGetCampaignsPage', () => {
  it('lists campaigns collapsed by default, showing Draft/Live status', async () => {
    stubFetch((url) => {
      if (url === '/backend/admin/bet-and-get-campaigns') {
        return new Response(JSON.stringify([draftCampaign]), { status: 200 });
      }
      return undefined;
    });

    renderPage();

    expect(await screen.findByText('CL Bet & Get')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save details' })).not.toBeInTheDocument();
  });

  it('creating a new campaign posts its name and reward amount', async () => {
    const fetchMock = stubFetch((url, method, init) => {
      if (method === 'GET' && url === '/backend/admin/bet-and-get-campaigns') {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (method === 'POST' && url === '/backend/admin/bet-and-get-campaigns') {
        expect(JSON.parse(init!.body as string)).toEqual({ name: 'New Promo', rewardAmountCents: 1000 });
        return new Response(JSON.stringify({ ...draftCampaign, id: 'campaign-2', name: 'New Promo' }), { status: 200 });
      }
      return undefined;
    });

    renderPage();
    await screen.findByText('No campaigns yet - create one above.');

    await userEvent.type(screen.getByLabelText('Campaign name'), 'New Promo');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/bet-and-get-campaigns',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('toggling enabled sends a PATCH with the flipped value', async () => {
    const fetchMock = stubFetch((url, method, init) => {
      if (method === 'GET' && url === '/backend/admin/bet-and-get-campaigns') {
        return new Response(JSON.stringify([draftCampaign]), { status: 200 });
      }
      if (method === 'PATCH' && url === '/backend/admin/bet-and-get-campaigns/campaign-1') {
        expect(JSON.parse(init!.body as string)).toMatchObject({ enabled: true });
        return new Response(JSON.stringify({ ...draftCampaign, enabled: true }), { status: 200 });
      }
      return undefined;
    });

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /CL Bet & Get/ }));
    await userEvent.click(screen.getByLabelText(/Enabled/));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/bet-and-get-campaigns/campaign-1',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('deleting a campaign sends a DELETE for its id', async () => {
    const fetchMock = stubFetch((url, method) => {
      if (method === 'GET' && url === '/backend/admin/bet-and-get-campaigns') {
        return new Response(JSON.stringify([draftCampaign]), { status: 200 });
      }
      if (method === 'DELETE' && url === '/backend/admin/bet-and-get-campaigns/campaign-1') {
        return new Response(null, { status: 204 });
      }
      return undefined;
    });

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /CL Bet & Get/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete campaign' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/bet-and-get-campaigns/campaign-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('adding a match to scope from the live match picker, then saving, sends the full scope list', async () => {
    const fetchMock = stubFetch((url, method, init) => {
      if (method === 'GET' && url === '/backend/admin/bet-and-get-campaigns') {
        return new Response(JSON.stringify([draftCampaign]), { status: 200 });
      }
      if (method === 'GET' && url === '/api/events') {
        return new Response(
          JSON.stringify([
            {
              id: 'match-1',
              sport: 'Football',
              country: 'England',
              competition: 'Premier League',
              homeTeam: 'Arsenal',
              awayTeam: 'Chelsea',
              kickoff: '2026-07-25T15:00:00Z',
              isLive: false,
              markets: [],
            },
          ]),
          { status: 200 },
        );
      }
      if (method === 'PATCH' && url === '/backend/admin/bet-and-get-campaigns/campaign-1/scopes') {
        expect(JSON.parse(init!.body as string)).toEqual({
          scopes: [{ scopeType: 'MATCH', scopeValue: 'match-1' }],
        });
        return new Response(JSON.stringify({ ...draftCampaign, scopes: [{ id: 's1', scopeType: 'MATCH', scopeValue: 'match-1' }] }), {
          status: 200,
        });
      }
      return undefined;
    });

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /CL Bet & Get/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Add from live matches' }));
    await userEvent.click(await screen.findByRole('button', { name: /Football/ }));
    await userEvent.click(await screen.findByRole('button', { name: /England/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Premier League/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Add match' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save scope' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/bet-and-get-campaigns/campaign-1/scopes',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });
});
