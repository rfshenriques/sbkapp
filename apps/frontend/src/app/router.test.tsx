import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { routes } from './routes';

describe('router', () => {
  it('renders the app shell nav and the odds board page at the root path', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/'] });
    render(<RouterProvider router={router} />);

    expect(screen.getByText('Sportsbook')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Odds Board' })).toBeInTheDocument();
  });

  it('renders the match detail page with the route param', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/matches/123'] });
    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('heading', { name: 'Match 123' })).toBeInTheDocument();
  });

  it('renders the not-found page for unknown paths', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/nope'] });
    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});
