import { useCallback, useEffect, useState } from 'react';
import * as backendApi from '../../lib/backendApi';
import { urlBase64ToUint8Array } from '../../lib/vapid';
import { useAuth } from '../auth/useAuth';

/** Evaluated per-call rather than cached at module load - Safari/iOS PWA support varies, and tests stub these globals after this module has already been imported. */
function checkIsSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

/**
 * Per-device push opt-in - Web Push permission is inherently per-browser-
 * profile, so this is a toggle on *this* device, not an account-wide
 * setting. Source of truth for `isSubscribed` is the browser's own
 * PushManager state (synced on mount/auth change), not a stored flag -
 * permission can be revoked out-of-band by the OS/browser at any time.
 */
export function usePushSubscription() {
  const { isAuthenticated } = useAuth();
  const isSupported = checkIsSupported();
  const [permission, setPermission] = useState<NotificationPermission>(
    isSupported ? Notification.permission : 'denied',
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!checkIsSupported() || !isAuthenticated) {
      setIsSubscribed(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!cancelled) {
        setIsSubscribed(subscription !== null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const enable = useCallback(async () => {
    if (!checkIsSupported()) {
      return;
    }
    setError(null);
    try {
      // iOS/WebKit requires requestPermission() - and, per repeated real-
      // device reports, pushManager.subscribe() too - to run within the
      // same user-activation window as the triggering click. Fetching the
      // service worker registration and the VAPID key in parallel with the
      // permission prompt (rather than after it resolves) means nothing but
      // already-settled values sits between the grant and subscribe(),
      // instead of an extra network round trip that can silently drop the
      // activation window and make subscribe() throw. Chrome has no such
      // restriction, which is why this class of bug only shows up on iOS.
      const [registration, vapidPublicKey, permissionResult] = await Promise.all([
        navigator.serviceWorker.ready,
        backendApi.getPushVapidPublicKey(),
        Notification.requestPermission(),
      ]);
      setPermission(permissionResult);
      if (permissionResult !== 'granted') {
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
        throw new Error('Push subscription is missing its endpoint or keys.');
      }
      await backendApi.subscribePush({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        userAgent: navigator.userAgent,
      });
      setIsSubscribed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable push notifications.');
    }
  }, []);

  const disable = useCallback(async () => {
    if (!checkIsSupported()) {
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await backendApi.unsubscribePush(subscription.endpoint);
      await subscription.unsubscribe();
    }
    setIsSubscribed(false);
  }, []);

  return { isSupported, permission, isSubscribed, error, enable, disable };
}
