import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubOddsEngineFetch } from '../test/mockOddsEngine';
import ErrorPage from '../pages/ErrorPage';
import { AppShell } from './AppShell';
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
    // Real Madrid vs Barcelona is the only isLive:true fixture, so it's always
    // the featured match's heading regardless of kickoff-time sort order.
    expect(
      await screen.findByRole('heading', { name: 'Real Madrid vs Barcelona' }),
    ).toBeInTheDocument();
  });

  it('renders the match detail page for a known match id', async () => {
    renderAt('/matches/match-1');

    expect(await screen.findByRole('heading', { name: 'Arsenal vs Chelsea' })).toBeInTheDocument();
  });

  it('renders the not-found page for unknown paths', async () => {
    renderAt('/nope');

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('shows the friendly ErrorPage instead of the default crash screen when a page throws', async () => {
    function Boom(): never {
      throw new Error('boom');
    }

    const queryClient = new QueryClient();
    const router = createMemoryRouter([
      {
        path: '/',
        Component: AppShell,
        ErrorBoundary: ErrorPage,
        children: [{ index: true, Component: Boom }],
      },
    ]);

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: "Well, that didn't go to plan" })).toBeInTheDocument();
  });
});
