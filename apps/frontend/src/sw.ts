/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

// vite.config.ts sets registerType: 'autoUpdate', but that's a no-op for
// actually activating a new worker unless the worker itself agrees to skip
// the default "wait until every open tab is closed" lifecycle - the
// generateSW strategy wires this up automatically, injectManifest (required
// here for the push/notificationclick listeners below) does not, so it has
// to be explicit. Without this, a new deploy sits permanently in "waiting"
// for any visitor who doesn't fully close every tab - which on mobile,
// with the app pinned to a home screen or just kept in a background tab, is
// close to never - so real users silently keep the OLD cached build no
// matter how many times the site is redeployed underneath them.
self.skipWaiting();
clientsClaim();

// Manually replaces what the default generateSW strategy did automatically -
// see vite.config.ts's comment on why this file exists at all (injectManifest
// is the only way to add the push/notificationclick listeners below).
cleanupOutdatedCaches();
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
