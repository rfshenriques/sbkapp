import { afterEach, describe, expect, it, vi } from 'vitest';
import { enableServiceWorkerAutoReload } from './serviceWorkerAutoReload';

function stubServiceWorker() {
  const target = new EventTarget();
  vi.stubGlobal('navigator', { ...navigator, serviceWorker: target });
  return target;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('enableServiceWorkerAutoReload', () => {
  it('reloads the page once a new service worker takes control', () => {
    const serviceWorker = stubServiceWorker();
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });

    enableServiceWorkerAutoReload();
    serviceWorker.dispatchEvent(new Event('controllerchange'));

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('only reloads once, even if controllerchange fires again', () => {
    const serviceWorker = stubServiceWorker();
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });

    enableServiceWorkerAutoReload();
    serviceWorker.dispatchEvent(new Event('controllerchange'));
    serviceWorker.dispatchEvent(new Event('controllerchange'));

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does nothing in a browser with no service worker support', () => {
    vi.stubGlobal('navigator', { ...navigator, serviceWorker: undefined });

    expect(() => enableServiceWorkerAutoReload()).not.toThrow();
  });
});
