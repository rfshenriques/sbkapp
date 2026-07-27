import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

afterEach(cleanup);

// jsdom doesn't implement ResizeObserver (it doesn't do real layout at all,
// so there's nothing to observe) - components that use it (e.g. AppShell's
// fixed-header spacer) just need the constructor to exist and not throw.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
