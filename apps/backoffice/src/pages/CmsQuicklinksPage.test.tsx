import type { Match } from '@sportsbook/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStaffAuthStore } from '../features/auth/staffAuthStore';
import type { CompetitionQuicklink } from '../lib/backendApi';
import CmsQuicklinksPage from './CmsQuicklinksPage';

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <CmsQuicklinksPage />
    </QueryClientProvider>,
  );
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

describe('CmsQuicklinksPage', () => {
  it('lists the ranked competition alongside every other one available to add', async () => {
    const eplMatch: Match = {
      id: 'match-1',
      sport: 'Football',
      country: 'England',
      competition: 'EPL',
      homeTeam: 'Arsenal',
      awayTeam: 'Chelsea',
      kickoff: '2026-07-18T15:00:00Z',
      isLive: false,
      markets: [],
    };
    const laLigaMatch: Match = {
      id: 'match-2',
      sport: 'Football',
      country: 'Spain',
      competition: 'La Liga',
      homeTeam: 'Barcelona',
      awayTeam: 'Real Madrid',
      kickoff: '2026-07-18T18:00:00Z',
      isLive: false,
      markets: [],
    };
    const eplQuicklink: CompetitionQuicklink = {
      id: 'quicklink-1',
      brandId: 'brand-1',
      competition: 'EPL',
      order: 1,
      createdAt: '2026-07-18T00:00:00Z',
      updatedAt: '2026-07-18T00:00:00Z',
    };

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url === '/api/events') return new Response(JSON.stringify([eplMatch, laLigaMatch]), { status: 200 });
        if (url === '/backend/admin/competition-quicklinks') {
          return new Response(JSON.stringify([eplQuicklink]), { status: 200 });
        }
        return new Response(null, { status: 404 });
      }),
    );

    renderPage();

    expect(await screen.findByText('EPL')).toBeInTheDocument();
    expect(await screen.findByText('La Liga')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  it('adding an available competition posts it at the next order', async () => {
    const eplMatch: Match = {
      id: 'match-1',
      sport: 'Football',
      country: 'England',
      competition: 'EPL',
      homeTeam: 'Arsenal',
      awayTeam: 'Chelsea',
      kickoff: '2026-07-18T15:00:00Z',
      isLive: false,
      markets: [],
    };
    const laLigaMatch: Match = {
      id: 'match-2',
      sport: 'Football',
      country: 'Spain',
      competition: 'La Liga',
      homeTeam: 'Barcelona',
      awayTeam: 'Real Madrid',
      kickoff: '2026-07-18T18:00:00Z',
      isLive: false,
      markets: [],
    };
    const eplQuicklink: CompetitionQuicklink = {
      id: 'quicklink-1',
      brandId: 'brand-1',
      competition: 'EPL',
      order: 1,
      createdAt: '2026-07-18T00:00:00Z',
      updatedAt: '2026-07-18T00:00:00Z',
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'GET' && url === '/api/events') {
        return new Response(JSON.stringify([eplMatch, laLigaMatch]), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/admin/competition-quicklinks') {
        return new Response(JSON.stringify([eplQuicklink]), { status: 200 });
      }
      if (method === 'POST' && url === '/backend/admin/competition-quicklinks') {
        expect(JSON.parse(init!.body as string)).toEqual({ competition: 'La Liga', order: 2 });
        return new Response(
          JSON.stringify({ ...eplQuicklink, id: 'quicklink-2', competition: 'La Liga', order: 2 }),
          { status: 200 },
        );
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();
    await screen.findByText('La Liga');

    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/competition-quicklinks',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('removing a quicklinked competition sends a delete for its id', async () => {
    const eplMatch: Match = {
      id: 'match-1',
      sport: 'Football',
      country: 'England',
      competition: 'EPL',
      homeTeam: 'Arsenal',
      awayTeam: 'Chelsea',
      kickoff: '2026-07-18T15:00:00Z',
      isLive: false,
      markets: [],
    };
    const eplQuicklink: CompetitionQuicklink = {
      id: 'quicklink-1',
      brandId: 'brand-1',
      competition: 'EPL',
      order: 1,
      createdAt: '2026-07-18T00:00:00Z',
      updatedAt: '2026-07-18T00:00:00Z',
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'GET' && url === '/api/events') {
        return new Response(JSON.stringify([eplMatch]), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/admin/competition-quicklinks') {
        return new Response(JSON.stringify([eplQuicklink]), { status: 200 });
      }
      if (method === 'DELETE' && url === '/backend/admin/competition-quicklinks/quicklink-1') {
        return new Response(JSON.stringify(eplQuicklink), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();
    await screen.findByText('EPL');

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/competition-quicklinks/quicklink-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
