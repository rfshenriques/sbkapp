/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

// Manually replaces what the default generateSW strategy did automatically -
// see vite.config.ts's comment on why this file exists at all (injectManifest
// is the only way to add the push/notificationclick listeners below).
precacheAndRoute(self.__WB_MANIFEST);

interface PushPayload {
  title: string;
  body: string;
  targetUrl?: string;
}

self.addEventListener('push', (event) => {
  const data = event.data?.json() as PushPayload | undefined;
  if (!data) {
    return;
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      data: { targetUrl: data.targetUrl ?? '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data as { targetUrl?: string } | undefined)?.targetUrl ?? '/';
  event.waitUntil(self.clients.openWindow(targetUrl));
});
