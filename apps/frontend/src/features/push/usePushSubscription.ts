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
    const registration = await navigator.serviceWorker.ready;
    const permissionResult = await Notification.requestPermission();
    setPermission(permissionResult);
    if (permissionResult !== 'granted') {
      return;
    }

    const vapidPublicKey = await backendApi.getPushVapidPublicKey();
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
      return;
    }
    await backendApi.subscribePush({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      userAgent: navigator.userAgent,
    });
    setIsSubscribed(true);
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

  return { isSupported, permission, isSubscribed, enable, disable };
}
