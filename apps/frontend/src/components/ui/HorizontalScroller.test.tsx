import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HorizontalScroller } from './HorizontalScroller';

function items(count: number) {
  return Array.from({ length: count }, (_, index) => (
    <div key={index} className="w-40 shrink-0 snap-start">
      Item {index}
    </div>
  ));
}

/** jsdom doesn't implement scrollBy/scrollTo - stub them directly on the rendered scroll container so calls can be asserted. */
function stubScrollMethods(group: HTMLElement) {
  const scrollBy = vi.fn();
  const scrollTo = vi.fn();
  group.scrollBy = scrollBy;
  group.scrollTo = scrollTo;
  return { scrollBy, scrollTo };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('HorizontalScroller initial scroll position', () => {
  it('resets scrollLeft back to 0 whenever the item set changes, so a stale/carried-over position (or a browser resolving a center-aligned snap point to something other than the first item) never leaves the first item hidden', () => {
    const { rerender } = render(
      <HorizontalScroller itemCount={3} ariaLabel="Test">
        {items(3)}
      </HorizontalScroller>,
    );
    const group = screen.getByRole('group', { name: 'Test' });
    Object.defineProperty(group, 'scrollLeft', { value: 300, writable: true, configurable: true });
    expect(group.scrollLeft).toBe(300);

    rerender(
      <HorizontalScroller itemCount={2} ariaLabel="Test">
        {items(2)}
      </HorizontalScroller>,
    );

    expect(group.scrollLeft).toBe(0);
  });
});

describe('HorizontalScroller auto-scroll', () => {
  it('advances exactly to the next child\'s own offset, not an approximate viewport-percentage nudge', () => {
    render(
      <HorizontalScroller itemCount={3} ariaLabel="Test" autoScrollSeconds={5}>
        {items(3)}
      </HorizontalScroller>,
    );

    const group = screen.getByRole('group', { name: 'Test' });
    // jsdom reports 0 for scrollWidth/clientWidth/offsetLeft by default
    // (nothing to scroll) - simulate an actual mid-scroll, 3-equal-width-
    // item state so this test exercises the real branch.
    Object.defineProperty(group, 'scrollWidth', { value: 900, configurable: true });
    Object.defineProperty(group, 'clientWidth', { value: 300, configurable: true });
    Object.defineProperty(group, 'scrollLeft', { value: 0, configurable: true });
    const children = Array.from(group.children) as HTMLElement[];
    children.forEach((child, index) =>
      Object.defineProperty(child, 'offsetLeft', { value: index * 300, configurable: true }),
    );
    const { scrollTo } = stubScrollMethods(group);

    expect(scrollTo).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5000);
    // From scrollLeft 0, the next child ahead is index 1 at offsetLeft 300 -
    // landing there exactly, not scrollByPage's approximate 0.9 * 300 = 270.
    expect(scrollTo).toHaveBeenCalledWith({ left: 300, behavior: 'smooth' });
  });

  it('loops back to the start once scrolled to the end', () => {
    render(
      <HorizontalScroller itemCount={3} ariaLabel="Test" autoScrollSeconds={5}>
        {items(3)}
      </HorizontalScroller>,
    );

    // jsdom reports 0 for scrollWidth/clientWidth/scrollLeft by default, so
    // maxScroll is 0 and scrollLeft (0) >= maxScroll - 4 is already true -
    // every tick takes the "loop back to start" branch.
    const group = screen.getByRole('group', { name: 'Test' });
    const { scrollTo } = stubScrollMethods(group);

    vi.advanceTimersByTime(5000);
    expect(scrollTo).toHaveBeenCalledWith({ left: 0, behavior: 'smooth' });
  });

  it('does not schedule any auto-scroll when autoScrollSeconds is unset', () => {
    render(
      <HorizontalScroller itemCount={3} ariaLabel="Test">
        {items(3)}
      </HorizontalScroller>,
    );

    const group = screen.getByRole('group', { name: 'Test' });
    const { scrollBy, scrollTo } = stubScrollMethods(group);

    vi.advanceTimersByTime(60_000);
    expect(scrollBy).not.toHaveBeenCalled();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('does not schedule any auto-scroll when there is only one item', () => {
    render(
      <HorizontalScroller itemCount={1} ariaLabel="Test" autoScrollSeconds={5}>
        {items(1)}
      </HorizontalScroller>,
    );

    const group = screen.getByRole('group', { name: 'Test' });
    const { scrollBy, scrollTo } = stubScrollMethods(group);

    vi.advanceTimersByTime(60_000);
    expect(scrollBy).not.toHaveBeenCalled();
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
