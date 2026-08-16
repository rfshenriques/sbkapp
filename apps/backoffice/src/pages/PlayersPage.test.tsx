import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlayerSummary } from '../lib/backendApi';
import PlayersPage from './PlayersPage';

const players: PlayerSummary[] = [
  {
    id: 'player-1',
    email: 'alice@example.com',
    username: 'alice',
    phone: '+15551234567',
    balanceCents: 12_345,
    createdAt: '2026-07-01T00:00:00.000Z',
  },
];

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PlayersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PlayersPage', () => {
  it('lists matching players with a link to their detail page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.startsWith('/backend/admin/players')) {
          return Promise.resolve(new Response(JSON.stringify(players), { status: 200 }));
        }
        return Promise.resolve(new Response(null, { status: 404 }));
      }),
    );

    renderPage();

    expect(await screen.findByRole('link', { name: 'alice' })).toHaveAttribute('href', '/players/player-1');
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('123.45')).toBeInTheDocument();
  });

  it('shows an honest empty state with no matches', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 })));

    renderPage();

    expect(await screen.findByText('No players match this search.')).toBeInTheDocument();
  });

  it('re-queries the backend as the search text changes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    renderPage();
    await screen.findByText('No players match this search.');

    await userEvent.type(screen.getByLabelText('Search by email, username, or phone'), 'alice');

    expect(
      fetchMock.mock.calls.some(([input]) => {
        const url = typeof input === 'string' ? input : input.toString();
        return url === '/backend/admin/players?query=alice';
      }),
    ).toBe(true);
  });
});
