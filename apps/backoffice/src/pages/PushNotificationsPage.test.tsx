import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStaffAuthStore } from '../features/auth/staffAuthStore';
import type { PushNotification, PushNotificationDetail } from '../lib/backendApi';
import PushNotificationsPage from './PushNotificationsPage';

const sentNotification: PushNotification = {
  id: 'push-1',
  kind: 'CUSTOM',
  title: 'Weekend offer',
  body: 'Check out our weekend boosts!',
  targetUrl: null,
  audienceMode: 'ALL',
  betAndGetCampaignId: null,
  depositCampaignId: null,
  sourceBetId: null,
  ttlSeconds: 86400,
  sentByStaffUserId: 'staff-1',
  sentByUsername: 'trading_alice',
  createdAt: '2026-07-24T00:00:00Z',
  _count: { recipients: 2 },
};

const notificationDetail: PushNotificationDetail = {
  id: 'push-1',
  kind: 'CUSTOM',
  title: 'Weekend offer',
  body: 'Check out our weekend boosts!',
  targetUrl: null,
  audienceMode: 'ALL',
  betAndGetCampaignId: null,
  depositCampaignId: null,
  sourceBetId: null,
  ttlSeconds: 86400,
  sentByStaffUserId: 'staff-1',
  sentByUsername: 'trading_alice',
  createdAt: '2026-07-24T00:00:00Z',
  recipients: [
    { id: 'r1', userId: 'u1', endpoint: 'https://push.example.com/1', status: 'SENT', statusCode: null, errorMessage: null, sentAt: '2026-07-24T00:00:00Z', user: { username: 'player1' } },
    { id: 'r2', userId: 'u2', endpoint: 'https://push.example.com/2', status: 'FAILED', statusCode: 410, errorMessage: 'gone', sentAt: '2026-07-24T00:00:00Z', user: { username: 'player2' } },
  ],
};

function renderPage(initialState?: { betAndGetCampaignId?: string; depositCampaignId?: string; campaignName?: string }) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[{ pathname: '/push-notifications', state: initialState }]}>
        <PushNotificationsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function stubFetch(handler: (url: string, method: string, init?: RequestInit) => Response | Promise<Response> | undefined) {
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
  useStaffAuthStore.setState({
    accessToken: 'header.payload.signature',
    user: { sub: 'staff-1', username: 'trading_alice', role: 'CRM' },
    isInitialized: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PushNotificationsPage', () => {
  it('disables Send until title and body are both filled', async () => {
    stubFetch((url, method) => {
      if (method === 'GET' && url === '/backend/admin/push-notifications') {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return undefined;
    });

    renderPage();

    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Push notification title'), 'Hello');
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Push notification body'), 'World');
    expect(screen.getByRole('button', { name: 'Send' })).not.toBeDisabled();
  });

  it('sends a CUSTOM push with the default ALL audience', async () => {
    const fetchMock = stubFetch((url, method, init) => {
      if (method === 'GET' && url === '/backend/admin/push-notifications') {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (method === 'POST' && url === '/backend/admin/push-notifications') {
        expect(JSON.parse(init!.body as string)).toEqual({
          title: 'Hello',
          body: 'World',
          audienceMode: 'ALL',
          segmentIds: [],
        });
        return new Response(JSON.stringify(sentNotification), { status: 200 });
      }
      return undefined;
    });

    renderPage();
    await userEvent.type(screen.getByLabelText('Push notification title'), 'Hello');
    await userEvent.type(screen.getByLabelText('Push notification body'), 'World');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(fetchMock).toHaveBeenCalledWith('/backend/admin/push-notifications', expect.objectContaining({ method: 'POST' }));
  });

  it('choosing "Specific player segments" loads and includes selected segment ids', async () => {
    const fetchMock = stubFetch((url, method, init) => {
      if (method === 'GET' && url === '/backend/admin/push-notifications') {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/admin/player-segments') {
        return new Response(
          JSON.stringify([{ id: 'seg-1', brandId: 'brand-1', name: 'High rollers', description: null, colorHex: null, createdAt: '', updatedAt: '', members: [] }]),
          { status: 200 },
        );
      }
      if (method === 'POST' && url === '/backend/admin/push-notifications') {
        expect(JSON.parse(init!.body as string)).toEqual({
          title: 'Hello',
          body: 'World',
          audienceMode: 'SEGMENTS',
          segmentIds: ['seg-1'],
        });
        return new Response(JSON.stringify(sentNotification), { status: 200 });
      }
      return undefined;
    });

    renderPage();
    await userEvent.type(screen.getByLabelText('Push notification title'), 'Hello');
    await userEvent.type(screen.getByLabelText('Push notification body'), 'World');
    await userEvent.selectOptions(screen.getByLabelText('Audience'), 'SEGMENTS');
    await userEvent.click(await screen.findByText('High rollers'));
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(fetchMock).toHaveBeenCalledWith('/backend/admin/push-notifications', expect.objectContaining({ method: 'POST' }));
  });

  it('arriving with a campaign pre-fill locks the audience and links the campaign id', async () => {
    const fetchMock = stubFetch((url, method, init) => {
      if (method === 'GET' && url === '/backend/admin/push-notifications') {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (method === 'POST' && url === '/backend/admin/push-notifications') {
        expect(JSON.parse(init!.body as string)).toEqual({
          title: 'Hello',
          body: 'World',
          betAndGetCampaignId: 'campaign-1',
        });
        return new Response(JSON.stringify(sentNotification), { status: 200 });
      }
      return undefined;
    });

    renderPage({ betAndGetCampaignId: 'campaign-1', campaignName: 'CL Bet & Get' });

    expect(screen.getByText(/CL Bet & Get/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Audience')).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Push notification title'), 'Hello');
    await userEvent.type(screen.getByLabelText('Push notification body'), 'World');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(fetchMock).toHaveBeenCalledWith('/backend/admin/push-notifications', expect.objectContaining({ method: 'POST' }));
  });

  it('renders send history and expands to show per-recipient delivery status', async () => {
    stubFetch((url, method) => {
      if (method === 'GET' && url === '/backend/admin/push-notifications') {
        return new Response(JSON.stringify([sentNotification]), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/admin/push-notifications/push-1') {
        return new Response(JSON.stringify(notificationDetail), { status: 200 });
      }
      return undefined;
    });

    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /Weekend offer/ }));

    expect(await screen.findByText('player1')).toBeInTheDocument();
    expect(screen.getByText('player2')).toBeInTheDocument();
    expect(screen.getByText('Sent')).toBeInTheDocument();
    expect(screen.getByText('Failed (410)')).toBeInTheDocument();
  });
});
