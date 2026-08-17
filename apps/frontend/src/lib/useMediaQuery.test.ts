import { renderHook, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMediaQuery } from './useMediaQuery';

function stubMatchMedia(initialMatches: boolean) {
  let matches = initialMatches;
  let listener: (() => void) | null = null;
  const mediaQueryList = {
    get matches() {
      return matches;
    },
    addEventListener: (_event: string, callback: () => void) => {
      listener = callback;
    },
    removeEventListener: () => {
      listener = null;
    },
  };
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mediaQueryList));
  return {
    setMatches: (value: boolean) => {
      matches = value;
      listener?.();
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useMediaQuery', () => {
  it('returns the initial match state', () => {
    stubMatchMedia(true);

    const { result } = renderHook(() => useMediaQuery('(min-width: 1280px)'));

    expect(result.current).toBe(true);
  });

  it('updates reactively when the media query state changes', () => {
    const { setMatches } = stubMatchMedia(false);

    const { result } = renderHook(() => useMediaQuery('(min-width: 1280px)'));
    expect(result.current).toBe(false);

    act(() => setMatches(true));

    expect(result.current).toBe(true);
  });

  it('defaults to false when matchMedia is unavailable (e.g. jsdom without a stub)', () => {
    vi.stubGlobal('matchMedia', undefined);

    const { result } = renderHook(() => useMediaQuery('(min-width: 1280px)'));

    expect(result.current).toBe(false);
  });
});
