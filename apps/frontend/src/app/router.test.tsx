import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { routes } from './routes';

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

  it('renders the match detail page with the route param', async () => {
    renderAt('/matches/123');

    expect(await screen.findByRole('heading', { name: 'Match 123' })).toBeInTheDocument();
  });

  it('renders the not-found page for unknown paths', async () => {
    renderAt('/nope');

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});
