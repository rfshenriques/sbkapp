import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { ChevronIcon } from './ChevronIcon';

export interface HorizontalScrollerProps {
  /** Each direct child is one snap point - give every child its own shrink-0/snap-* classes. */
  children: ReactNode;
  /** Drives the dot count and the scroll-position-to-dot mapping. */
  itemCount: number;
  ariaLabel: string;
  className?: string;
  /** When set (and there's more than one item), auto-advances one item every N seconds, looping back to the start at the end - see the backoffice's Homepage auto-scroll setting. */
  autoScrollSeconds?: number;
}

/**
 * Shared shell for every horizontally-scrolling content block (Live now,
 * Match of the day, Challenges, ...) - snap scrolling plus two things
 * layered on top: dot indicators (both breakpoints, so a swipeable block
 * doesn't look like "that's everything") and desktop-only overlay left/
 * right arrow buttons, since a mouse has no swipe gesture. Both only
 * appear when there's actually more than one item to move between - a
 * single-item block (today's reality for Match of the day/Challenges
 * until the CMS lets staff add more) renders with neither.
 */
export function HorizontalScroller({
  children,
  itemCount,
  ariaLabel,
  className,
  autoScrollSeconds,
}: HorizontalScrollerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    function updateScrollState() {
      const el = scrollRef.current;
      if (!el) {
        return;
      }
      const maxScroll = el.scrollWidth - el.clientWidth;
      setCanScrollLeft(el.scrollLeft > 4);
      setCanScrollRight(el.scrollLeft < maxScroll - 4);
      // Normalized scroll position mapped onto however many items there
      // are, rather than assuming a fixed item width - items aren't
      // always the same size (the mobile featured/promo pair share a
      // width, but that's a caller convention, not something this
      // component can rely on generally).
      const ratio = maxScroll > 4 ? el.scrollLeft / maxScroll : 0;
      setActiveIndex(Math.round(ratio * Math.max(itemCount - 1, 0)));
    }

    updateScrollState();
    const el = scrollRef.current;
    el?.addEventListener('scroll', updateScrollState);
    window.addEventListener('resize', updateScrollState);
    return () => {
      el?.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [itemCount]);

  function scrollByPage(direction: 1 | -1) {
    scrollRef.current?.scrollBy({ left: direction * scrollRef.current.clientWidth * 0.9, behavior: 'smooth' });
  }

  useEffect(() => {
    if (!autoScrollSeconds || itemCount <= 1) {
      return;
    }
    const id = window.setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (el.scrollLeft >= maxScroll - 4) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
        return;
      }
      // Land exactly on the next child's own offset rather than
      // scrollByPage's approximate 90%-of-viewport nudge - that fudge
      // factor is fine for a user-clicked arrow button, but for
      // auto-scroll it could undershoot a child's start (e.g. a 2-item
      // pair each ~ the container's width) and leave it only ~90%
      // revealed until a second tick nudged it the rest of the way.
      const children = Array.from(el.children) as HTMLElement[];
      const next = children.find((child) => child.offsetLeft > el.scrollLeft + 4);
      el.scrollTo({ left: next ? next.offsetLeft : maxScroll, behavior: 'smooth' });
    }, autoScrollSeconds * 1000);
    return () => window.clearInterval(id);
  }, [autoScrollSeconds, itemCount]);

  const showArrows = itemCount > 1 && (canScrollLeft || canScrollRight);

  return (
    <div className={cn('relative h-full', className)}>
      <div
        ref={scrollRef}
        role="group"
        aria-label={ariaLabel}
        data-horizontal-scroll="true"
        className="scrollbar-hide flex h-full snap-x snap-mandatory gap-3 overflow-x-auto"
      >
        {children}
      </div>

      {showArrows && (
        <>
          <button
            type="button"
            aria-label="Scroll left"
            onClick={() => scrollByPage(-1)}
            disabled={!canScrollLeft}
            className="absolute top-1/2 left-1 hidden -translate-y-1/2 items-center justify-center rounded-full bg-surface/90 p-2 text-text-primary shadow-lg backdrop-blur transition-opacity hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-0 sm:flex"
          >
            <ChevronIcon className="h-4 w-4 rotate-90" />
          </button>
          <button
            type="button"
            aria-label="Scroll right"
            onClick={() => scrollByPage(1)}
            disabled={!canScrollRight}
            className="absolute top-1/2 right-1 hidden -translate-y-1/2 items-center justify-center rounded-full bg-surface/90 p-2 text-text-primary shadow-lg backdrop-blur transition-opacity hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-0 sm:flex"
          >
            <ChevronIcon className="h-4 w-4 -rotate-90" />
          </button>
        </>
      )}

      {itemCount > 1 && (
        <div className="mt-2 flex items-center justify-center gap-1.5" aria-hidden="true">
          {Array.from({ length: itemCount }).map((_, index) => (
            <span
              key={index}
              className={cn(
                'h-1.5 rounded-full transition-all',
                index === activeIndex ? 'w-4 bg-highlight' : 'w-1.5 bg-text-muted/40',
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
