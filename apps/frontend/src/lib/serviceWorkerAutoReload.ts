/**
 * Once a new service worker (deployed after this page loaded) takes control
 * - see sw.ts's skipWaiting()/clientsClaim(), which is what lets that
 * happen at all instead of the new worker sitting in "waiting" forever -
 * the open page is still running the OLD JS/HTML from memory. A single
 * reload is what actually picks up the new build; without this, the
 * worker updates silently in the background but the visible page never
 * changes until the player happens to navigate or refresh on their own.
 * `controllerchange` only fires when an already-controlled page gets handed
 * to a *different* worker, never on a page's first-ever registration, so
 * this can't cause a reload loop on a normal first visit.
 */
export function enableServiceWorkerAutoReload(): void {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
    return;
  }
  let hasReloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hasReloaded) return;
    hasReloaded = true;
    window.location.reload();
  });
}
