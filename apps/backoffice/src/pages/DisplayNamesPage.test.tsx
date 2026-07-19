import type { Match } from '@sportsbook/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStaffAuthStore } from '../features/auth/staffAuthStore';
import type { DisplayNameOverride } from '../lib/backendApi';
import DisplayNamesPage from './DisplayNamesPage';

const liveMatch: Match = {
  id: 'match-1',
  sport: 'Football',
  country: 'Europe',
  competition: 'UEFA Champions League Qualification',
  homeTeam: 'Mjallby AIF',
  awayTeam: 'Lincoln Red Imps FC',
  kickoff: '2026-07-18T15:00:00Z',
  isLive: false,
  markets: [],
};

const competitionOverride: DisplayNameOverride = {
  id: 'dn-1',
  entityType: 'COMPETITION',
  rawName: 'UEFA Champions League Qualification',
  displayName: null,
  createdAt: '2026-07-18T00:00:00Z',
  updatedAt: '2026-07-18T00:00:00Z',
};

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <DisplayNamesPage />
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

describe('DisplayNamesPage', () => {
  it('syncs all four entity types from the live feed on load, then lists the Competitions tab by default', async () => {
    const synced: Record<string, string[]> = {};
    let competitions: DisplayNameOverride[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'GET' && url === '/api/events') {
        return new Response(JSON.stringify([liveMatch]), { status: 200 });
      }
      if (method === 'POST' && url === '/backend/admin/display-names/sync') {
        const body = JSON.parse(init!.body as string) as { entityType: string; names: string[] };
        synced[body.entityType] = body.names;
        if (body.entityType === 'COMPETITION') {
          competitions = [competitionOverride];
        }
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/admin/display-names?entityType=COMPETITION') {
        return new Response(JSON.stringify(competitions), { status: 200 });
      }
      if (method === 'GET' && url.startsWith('/backend/admin/display-names?entityType=')) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    expect(await screen.findByText('UEFA Champions League Qualification')).toBeInTheDocument();
    expect(synced).toEqual({
      SPORT: ['Football'],
      COUNTRY: ['Europe'],
      COMPETITION: ['UEFA Champions League Qualification'],
      TEAM: ['Mjallby AIF', 'Lincoln Red Imps FC'],
    });
  });

  it('setting a display name sends the right request', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'GET' && url === '/api/events') {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/admin/display-names?entityType=COMPETITION') {
        return new Response(JSON.stringify([competitionOverride]), { status: 200 });
      }
      if (method === 'PATCH' && url === '/backend/admin/display-names/dn-1') {
        expect(JSON.parse(init!.body as string)).toEqual({ displayName: 'UEFA Champions League (Q)' });
        return new Response(
          JSON.stringify({ ...competitionOverride, displayName: 'UEFA Champions League (Q)' }),
          { status: 200 },
        );
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();
    await screen.findByText('UEFA Champions League Qualification');

    const saveButton = screen.getByRole('button', { name: 'Save' });
    expect(saveButton).toBeDisabled();

    const input = screen.getByLabelText('UEFA Champions League Qualification display name');
    await userEvent.type(input, 'UEFA Champions League (Q)');
    expect(saveButton).toBeEnabled();

    await userEvent.click(saveButton);

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/display-names/dn-1',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('switching tabs loads that entity type', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'GET' && url === '/api/events') {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/admin/display-names?entityType=COMPETITION') {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/admin/display-names?entityType=TEAM') {
        return new Response(
          JSON.stringify([
            { id: 'dn-2', entityType: 'TEAM', rawName: 'Arsenal', displayName: null, createdAt: '', updatedAt: '' },
          ]),
          { status: 200 },
        );
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();
    await screen.findByText('Nothing here yet - they\'ll appear once matches are live.');

    await userEvent.click(screen.getByRole('button', { name: 'Teams' }));

    expect(await screen.findByText('Arsenal')).toBeInTheDocument();
  });
});
