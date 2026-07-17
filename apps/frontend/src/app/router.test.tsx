import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubOddsEngineFetch } from '../test/mockOddsEngine';
import { routes } from './routes';

beforeEach(() => {
  stubOddsEngineFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderAt(initialPath: string) {
  const queryClient = new QueryClient();
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('router', () => {
  it('renders the app shell nav and the odds board page at the root path', async () => {
    renderAt('/');

    expect(screen.getByText('Sportsbook')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Odds Board' })).toBeInTheDocument();
  });

  it('renders the match detail page for a known match id', async () => {
    renderAt('/matches/match-1');

    expect(await screen.findByRole('heading', { name: 'Arsenal vs Chelsea' })).toBeInTheDocument();
  });

  it('renders the not-found page for unknown paths', async () => {
    renderAt('/nope');

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});
