import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDisplayNames } from './useDisplayNames';

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient();
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useDisplayNames', () => {
  it('falls back to the raw name when no override is set', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify([]), { status: 200 })),
    );

    const { result } = renderHook(() => useDisplayNames(), { wrapper });

    expect(result.current('COMPETITION', 'UEFA Champions League Qualification')).toBe(
      'UEFA Champions League Qualification',
    );
  });

  it('returns the backoffice-assigned override once loaded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify([
            {
              entityType: 'COMPETITION',
              rawName: 'UEFA Champions League Qualification',
              displayName: 'UEFA Champions League (Q)',
            },
          ]),
          { status: 200 },
        ),
      ),
    );

    const { result } = renderHook(() => useDisplayNames(), { wrapper });

    await waitFor(() => {
      expect(result.current('COMPETITION', 'UEFA Champions League Qualification')).toBe(
        'UEFA Champions League (Q)',
      );
    });
    // A different entity type with the same raw name is unaffected.
    expect(result.current('TEAM', 'UEFA Champions League Qualification')).toBe(
      'UEFA Champions League Qualification',
    );
  });
});
