import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../auth/authStore';
import * as backendApi from '../../lib/backendApi';
import { usePushSubscription } from './usePushSubscription';

vi.mock('../../lib/backendApi', async () => {
  const actual = await vi.importActual<typeof backendApi>('../../lib/backendApi');
  return {
    ...actual,
    getPushVapidPublicKey: vi.fn(),
    subscribePush: vi.fn(),
    unsubscribePush: vi.fn(),
  };
});

function stubPushSubscription(existing: PushSubscription | null) {
  const getSubscription = vi.fn().mockResolvedValue(existing);
  const subscribe = vi.fn().mockResolvedValue({
    endpoint: 'https://push.example.com/new-endpoint',
    toJSON: () => ({
      endpoint: 'https://push.example.com/new-endpoint',
      keys: { p256dh: 'p256dh-value', auth: 'auth-value' },
    }),
    unsubscribe: vi.fn().mockResolvedValue(true),
  });
  const registration = { pushManager: { getSubscription, subscribe } };
  vi.stubGlobal('navigator', {
    ...navigator,
    serviceWorker: { ready: Promise.resolve(registration) },
    userAgent: 'test-agent',
  });
  vi.stubGlobal('PushManager', class {});
  vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue('granted'), permission: 'default' });
  return { getSubscription, subscribe, registration };
}

beforeEach(() => {
  useAuthStore.setState({ accessToken: 'header.payload.signature', user: null, isInitialized: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('usePushSubscription', () => {
  it('reports unsupported when the browser lacks PushManager/serviceWorker', () => {
    const { result } = renderHook(() => usePushSubscription());
    expect(result.current.isSupported).toBe(false);
  });

  it('syncs isSubscribed from the browser’s own PushManager state on mount', async () => {
    stubPushSubscription({ endpoint: 'https://push.example.com/existing' } as PushSubscription);

    const { result } = renderHook(() => usePushSubscription());

    await waitFor(() => expect(result.current.isSubscribed).toBe(true));
  });

  it('enable() requests permission, subscribes, and posts the subscription to the backend', async () => {
    stubPushSubscription(null);
    vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue('granted'), permission: 'default' });
    vi.mocked(backendApi.getPushVapidPublicKey).mockResolvedValue('dGVzdC12YXBpZC1rZXk');

    const { result } = renderHook(() => usePushSubscription());
    await waitFor(() => expect(result.current.isSupported).toBe(true));

    await result.current.enable();

    expect(backendApi.subscribePush).toHaveBeenCalledWith({
      endpoint: 'https://push.example.com/new-endpoint',
      keys: { p256dh: 'p256dh-value', auth: 'auth-value' },
      userAgent: 'test-agent',
    });
  });

  it('never calls subscribePush when permission is denied', async () => {
    stubPushSubscription(null);
    vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue('denied'), permission: 'default' });

    const { result } = renderHook(() => usePushSubscription());
    await waitFor(() => expect(result.current.isSupported).toBe(true));

    await result.current.enable();

    expect(backendApi.subscribePush).not.toHaveBeenCalled();
  });

  it('disable() unsubscribes both the backend record and the browser subscription', async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true);
    const existing = { endpoint: 'https://push.example.com/existing', unsubscribe } as unknown as PushSubscription;
    stubPushSubscription(existing);

    const { result } = renderHook(() => usePushSubscription());
    await waitFor(() => expect(result.current.isSubscribed).toBe(true));

    await result.current.disable();

    expect(backendApi.unsubscribePush).toHaveBeenCalledWith('https://push.example.com/existing');
    expect(unsubscribe).toHaveBeenCalled();
  });
});
