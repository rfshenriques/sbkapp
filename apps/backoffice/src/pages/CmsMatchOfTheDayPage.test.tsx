import type { Match } from '@sportsbook/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStaffAuthStore } from '../features/auth/staffAuthStore';
import type { MatchOfTheDayEntry } from '../lib/backendApi';
import CmsMatchOfTheDayPage from './CmsMatchOfTheDayPage';

const liveMatch: Match = {
  id: 'match-1',
  sport: 'Football',
  country: 'England',
  competition: 'Premier League',
  homeTeam: 'Arsenal',
  awayTeam: 'Chelsea',
  kickoff: '2026-07-18T15:00:00Z',
  isLive: false,
  markets: [],
};

const otherMatch: Match = {
  ...liveMatch,
  id: 'match-2',
  homeTeam: 'Liverpool',
  awayTeam: 'Everton',
};

const entry: MatchOfTheDayEntry = {
  id: 'entry-1',
  brandId: 'brand-1',
  matchId: 'match-1',
  sortOrder: 0,
  enabled: true,
  startAt: null,
  endAt: null,
  createdAt: '2026-08-17T00:00:00Z',
  updatedAt: '2026-08-17T00:00:00Z',
};

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <CmsMatchOfTheDayPage />
    </QueryClientProvider>,
  );
}

function stubFetch(handler: (url: string, method: string, init?: RequestInit) => Response | Promise<Response> | undefined) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method ?? 'GET';
    const result = await handler(url, method, init);
    if (result) return result;
    if (url === '/api/events') {
      return new Response(JSON.stringify([liveMatch, otherMatch]), { status: 200 });
    }
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  useStaffAuthStore.setState({
    accessToken: 'header.payload.signature',
    user: { sub: 'staff-1', username: 'cms_alice', role: 'CMS' },
    isInitialized: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CmsMatchOfTheDayPage', () => {
  it('shows the empty state and lets staff pick a live match to feature', async () => {
    const fetchMock = stubFetch((url, method) => {
      if (method === 'GET' && url === '/backend/admin/match-of-the-day') {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (method === 'POST' && url === '/backend/admin/match-of-the-day') {
        return new Response(JSON.stringify(entry), { status: 201 });
      }
    });
    renderPage();

    expect(await screen.findByText('No Match of the day entries yet - pick one below.')).toBeInTheDocument();

    await userEvent.click(await screen.findByRole('button', { name: /Football \(2\)/ }));
    await userEvent.click(await screen.findByRole('button', { name: /England \(2\)/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Premier League \(2\)/ }));
    const featureButtons = await screen.findAllByRole('button', { name: 'Feature as Match of the day' });
    await userEvent.click(featureButtons[0]!);

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/match-of-the-day',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ matchId: 'match-1' }) }),
    );
  });

  it('lists an existing entry with its resolved match label', async () => {
    stubFetch((url, method) => {
      if (method === 'GET' && url === '/backend/admin/match-of-the-day') {
        return new Response(JSON.stringify([entry]), { status: 200 });
      }
    });
    renderPage();

    expect(await screen.findByText('Arsenal vs Chelsea')).toBeInTheDocument();
    expect(screen.getByText('Enabled')).toBeInTheDocument();
  });

  it('expanding a row already featuring a match disables its "Feature" button in the drilldown', async () => {
    stubFetch((url, method) => {
      if (method === 'GET' && url === '/backend/admin/match-of-the-day') {
        return new Response(JSON.stringify([entry]), { status: 200 });
      }
    });
    renderPage();

    await screen.findByText('Arsenal vs Chelsea');
    await userEvent.click(await screen.findByRole('button', { name: /Football \(2\)/ }));
    await userEvent.click(await screen.findByRole('button', { name: /England \(2\)/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Premier League \(2\)/ }));

    expect(await screen.findByRole('button', { name: 'Already featured' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Feature as Match of the day' })).toBeEnabled();
  });

  it('toggling enabled and saving patches the entry', async () => {
    const fetchMock = stubFetch((url, method) => {
      if (method === 'GET' && url === '/backend/admin/match-of-the-day') {
        return new Response(JSON.stringify([entry]), { status: 200 });
      }
      if (method === 'PATCH' && url === '/backend/admin/match-of-the-day/entry-1') {
        return new Response(JSON.stringify({ ...entry, enabled: false }), { status: 200 });
      }
    });
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /Arsenal vs Chelsea/ }));
    const checkbox = screen.getByRole('checkbox', { name: 'Enabled' });
    await userEvent.click(checkbox);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/match-of-the-day/entry-1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ enabled: false, startAt: null, endAt: null }),
      }),
    );
  });

  it('removes an entry', async () => {
    const fetchMock = stubFetch((url, method) => {
      if (method === 'GET' && url === '/backend/admin/match-of-the-day') {
        return new Response(JSON.stringify([entry]), { status: 200 });
      }
      if (method === 'DELETE' && url === '/backend/admin/match-of-the-day/entry-1') {
        return new Response(null, { status: 204 });
      }
    });
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /Arsenal vs Chelsea/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/match-of-the-day/entry-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('falls back to the raw matchId when the live feed no longer has that match', async () => {
    stubFetch((url, method) => {
      if (method === 'GET' && url === '/backend/admin/match-of-the-day') {
        return new Response(JSON.stringify([{ ...entry, matchId: 'stale-match-id' }]), { status: 200 });
      }
    });
    renderPage();

    expect(await screen.findByText('stale-match-id')).toBeInTheDocument();
  });
});
