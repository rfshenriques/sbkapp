import { useEffect } from 'react';

/**
 * Locks page scroll while `active` is true. Plain `overflow: hidden` on the
 * body isn't reliable on iOS Safari - the page can still rubber-band/scroll
 * underneath, and position:fixed overlays (the mobile sports drawer, every
 * BottomSheet) can visibly detach from the viewport mid-scroll. Pinning the
 * body itself to `position: fixed` at its current scroll offset actually
 * removes it from the scrollable document instead of just clipping it,
 * which is the standard cross-browser-safe fix; the offset is restored via
 * `window.scrollTo` once unlocked.
 */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) {
      return;
    }
    const scrollY = window.scrollY;
    const { body } = document;
    const previousPosition = body.style.position;
    const previousTop = body.style.top;
    const previousWidth = body.style.width;
    const previousOverflow = body.style.overflow;

    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    body.classList.add('scroll-locked');

    return () => {
      body.style.position = previousPosition;
      body.style.top = previousTop;
      body.style.width = previousWidth;
      body.style.overflow = previousOverflow;
      body.classList.remove('scroll-locked');
      window.scrollTo(0, scrollY);
    };
  }, [active]);
}
