import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubOddsEngineFetch } from '../test/mockOddsEngine';
import { useAuthStore } from '../features/auth/authStore';
import ErrorPage from '../pages/ErrorPage';
import { AppShell } from './AppShell';
import { routes } from './routes';

beforeEach(() => {
  stubOddsEngineFetch();
  // These tests check that a given path renders the right page, not the
  // separate forced-login-on-load behavior (covered in AppShell.test.tsx) -
  // pre-authenticate so an unauthenticated redirect to /login never fires
  // and steps on the page-specific assertions below.
  useAuthStore.setState({
    accessToken: 'header.payload.signature',
    user: null,
    isInitialized: true,
  });
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

    // The mocked brand's real name (see stubOddsEngineFetch) - AppShell no
    // longer ever shows the generic "Sportsbook" fallback once a brand
    // resolves, it shows the boot spinner until then instead (see
    // AppBootScreen.tsx).
    expect(await screen.findByText('Test Brand')).toBeInTheDocument();
    // Real Madrid vs Barcelona is the only isLive:true fixture, so it's always
    // the featured match's heading regardless of kickoff-time sort order.
    // The featured card renders twice (a mobile copy and a desktop copy,
    // each CSS-hidden at the other breakpoint but both present in jsdom),
    // so this expects at least one rather than exactly one.
    expect(
      (await screen.findAllByRole('heading', { name: 'Real Madrid vs Barcelona' })).length,
    ).toBeGreaterThan(0);
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
