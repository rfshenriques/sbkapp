import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from './authStore';
import { useForceLogout } from './useForceLogout';

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
}

beforeEach(() => {
  useAuthStore.setState({ accessToken: 'header.payload.signature', user: null, isInitialized: true });
  setHidden(false);
});

afterEach(() => {
  useAuthStore.setState({ accessToken: null, user: null, isInitialized: true });
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('useForceLogout', () => {
  it('logs out immediately when the document is backgrounded', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useForceLogout());

    setHidden(true);
    document.dispatchEvent(new Event('visibilitychange'));
    // logout() awaits the fetch before clearing auth - flush that microtask.
    await vi.waitFor(() => expect(useAuthStore.getState().accessToken).toBeNull());

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/auth/logout'), expect.objectContaining({ method: 'POST' }));
  });

  it('logs out via sendBeacon on pagehide, clearing auth immediately without waiting for a response', () => {
    const beaconMock = vi.fn().mockReturnValue(true);
    vi.stubGlobal('sendBeacon', beaconMock);
    Object.defineProperty(navigator, 'sendBeacon', { value: beaconMock, configurable: true });

    renderHook(() => useForceLogout());

    window.dispatchEvent(new Event('pagehide'));

    expect(beaconMock).toHaveBeenCalledWith(expect.stringContaining('/auth/logout'));
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('logs out after 5 minutes with no activity', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useForceLogout());

    await vi.advanceTimersByTimeAsync(5 * 60_000);

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/auth/logout'), expect.objectContaining({ method: 'POST' }));
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('activity resets the idle timer instead of letting it expire', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useForceLogout());

    await vi.advanceTimersByTimeAsync(4 * 60_000);
    window.dispatchEvent(new Event('pointerdown'));
    await vi.advanceTimersByTimeAsync(4 * 60_000);

    // 8 minutes have passed in total, but activity reset the clock at the
    // 4-minute mark, so only 4 minutes have elapsed since - not yet logged out.
    expect(useAuthStore.getState().accessToken).not.toBeNull();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('does nothing while unauthenticated', async () => {
    useAuthStore.setState({ accessToken: null, user: null, isInitialized: true });
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useForceLogout());

    await vi.advanceTimersByTimeAsync(10 * 60_000);
    setHidden(true);
    document.dispatchEvent(new Event('visibilitychange'));

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
