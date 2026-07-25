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

describe('HorizontalScroller auto-scroll', () => {
  it('advances the scroll position every autoScrollSeconds when there is more than one item', () => {
    render(
      <HorizontalScroller itemCount={3} ariaLabel="Test" autoScrollSeconds={5}>
        {items(3)}
      </HorizontalScroller>,
    );

    const group = screen.getByRole('group', { name: 'Test' });
    // jsdom reports 0 for scrollWidth/clientWidth by default (nothing to
    // scroll), which would always take the "loop back to start" branch -
    // simulate an actual mid-scroll state so this test exercises scrollBy.
    Object.defineProperty(group, 'scrollWidth', { value: 900, configurable: true });
    Object.defineProperty(group, 'clientWidth', { value: 300, configurable: true });
    Object.defineProperty(group, 'scrollLeft', { value: 0, configurable: true });
    const { scrollBy } = stubScrollMethods(group);

    expect(scrollBy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5000);
    expect(scrollBy).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5000);
    expect(scrollBy).toHaveBeenCalledTimes(2);
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
