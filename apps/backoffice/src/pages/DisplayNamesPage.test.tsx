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
  markets: [
    {
      id: 'match-result',
      name: 'Match Result',
      selections: [
        { id: 'home', name: 'Home', odds: 2.1 },
        { id: 'draw', name: 'Draw', odds: 3.4 },
        { id: 'away', name: 'Away', odds: 3.2 },
      ],
    },
  ],
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
  it('syncs all six entity types from the live feed on load, then lists the Competitions tab by default', async () => {
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

    // Competitions tab groups by country, one group expanded at a time -
    // the synced match's competition falls under its "Europe" country.
    await userEvent.click(await screen.findByRole('button', { name: /^Europe \(1\)/ }));
    expect(await screen.findByText('UEFA Champions League Qualification')).toBeInTheDocument();
    expect(synced).toEqual({
      SPORT: ['Football'],
      COUNTRY: ['Europe'],
      COMPETITION: ['UEFA Champions League Qualification'],
      TEAM: ['Mjallby AIF', 'Lincoln Red Imps FC'],
      MARKET: ['Match Result'],
      SELECTION: ['Home', 'Draw', 'Away'],
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
    // No live match feed in this test, so the override has no country
    // evidence and falls under the "Unknown" group.
    await userEvent.click(await screen.findByRole('button', { name: /^Unknown \(1\)/ }));
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

    // Teams are grouped by first letter, same as Team Colors - drill into
    // "A" to reach Arsenal.
    await userEvent.click(await screen.findByRole('button', { name: /^A \(1\)/ }));
    expect(await screen.findByText('Arsenal')).toBeInTheDocument();
  });

  it('groups the Teams tab by first letter (numeric names bucketed under 0-9), one group open at a time', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'GET' && url === '/api/events') {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/admin/display-names?entityType=TEAM') {
        return new Response(
          JSON.stringify([
            { id: 'dn-1', entityType: 'TEAM', rawName: 'Arsenal', displayName: null, createdAt: '', updatedAt: '' },
            { id: 'dn-2', entityType: 'TEAM', rawName: 'Aston Villa', displayName: null, createdAt: '', updatedAt: '' },
            {
              id: 'dn-3',
              entityType: 'TEAM',
              rawName: '1899 Hoffenheim',
              displayName: null,
              createdAt: '',
              updatedAt: '',
            },
          ]),
          { status: 200 },
        );
      }
      if (method === 'GET' && url.startsWith('/backend/admin/display-names?entityType=')) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Teams' }));

    const aGroup = await screen.findByRole('button', { name: /^A \(2\)/ });
    const numericGroup = screen.getByRole('button', { name: /^0-9 \(1\)/ });
    expect(screen.queryByText('Arsenal')).not.toBeInTheDocument();

    await userEvent.click(aGroup);
    expect(await screen.findByText('Arsenal')).toBeInTheDocument();
    expect(screen.getByText('Aston Villa')).toBeInTheDocument();
    expect(screen.queryByText('1899 Hoffenheim')).not.toBeInTheDocument();

    // Opening the numeric group closes "A" - only one group open at a time.
    await userEvent.click(numericGroup);
    expect(await screen.findByText('1899 Hoffenheim')).toBeInTheDocument();
    expect(screen.queryByText('Arsenal')).not.toBeInTheDocument();
  });

  it('has one Markets/Selections tab where expanding a market reveals its own selections, not every selection ever seen', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'GET' && url === '/api/events') {
        return new Response(JSON.stringify([liveMatch]), { status: 200 });
      }
      if (method === 'POST' && url === '/backend/admin/display-names/sync') {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/admin/display-names?entityType=MARKET') {
        return new Response(
          JSON.stringify([
            { id: 'dn-3', entityType: 'MARKET', rawName: 'Match Result', displayName: null, createdAt: '', updatedAt: '' },
          ]),
          { status: 200 },
        );
      }
      if (method === 'GET' && url === '/backend/admin/display-names?entityType=SELECTION') {
        return new Response(
          JSON.stringify([
            { id: 'dn-sel-home', entityType: 'SELECTION', rawName: 'Home', displayName: null, createdAt: '', updatedAt: '' },
            { id: 'dn-sel-draw', entityType: 'SELECTION', rawName: 'Draw', displayName: null, createdAt: '', updatedAt: '' },
            { id: 'dn-sel-away', entityType: 'SELECTION', rawName: 'Away', displayName: null, createdAt: '', updatedAt: '' },
          ]),
          { status: 200 },
        );
      }
      if (method === 'GET' && url.startsWith('/backend/admin/display-names?entityType=')) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Markets/Selections' }));

    const marketRow = await screen.findByRole('button', { name: /^Match Result \(3\)/ });
    expect(screen.queryByLabelText('Home display name')).not.toBeInTheDocument();

    await userEvent.click(marketRow);

    expect(await screen.findByLabelText('Match Result display name')).toBeInTheDocument();
    expect(screen.getByLabelText('Home display name')).toBeInTheDocument();
    expect(screen.getByLabelText('Draw display name')).toBeInTheDocument();
    expect(screen.getByLabelText('Away display name')).toBeInTheDocument();
  });

  it('groups the Competitions tab by country, one group at a time, but leaves other tabs flat', async () => {
    const eplOverride: DisplayNameOverride = {
      id: 'dn-4',
      entityType: 'COMPETITION',
      rawName: 'EPL',
      displayName: null,
      createdAt: '',
      updatedAt: '',
    };
    const laLigaOverride: DisplayNameOverride = {
      id: 'dn-5',
      entityType: 'COMPETITION',
      rawName: 'La Liga',
      displayName: null,
      createdAt: '',
      updatedAt: '',
    };
    const teamOverride: DisplayNameOverride = {
      id: 'dn-6',
      entityType: 'TEAM',
      rawName: 'Real Madrid',
      displayName: null,
      createdAt: '',
      updatedAt: '',
    };
    const matches: Match[] = [
      { ...liveMatch, id: 'm-epl', country: 'England', competition: 'EPL' },
      { ...liveMatch, id: 'm-laliga', country: 'Spain', competition: 'La Liga' },
    ];

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'GET' && url === '/api/events') {
        return new Response(JSON.stringify(matches), { status: 200 });
      }
      if (method === 'POST' && url === '/backend/admin/display-names/sync') {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/admin/display-names?entityType=COMPETITION') {
        return new Response(JSON.stringify([eplOverride, laLigaOverride]), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/admin/display-names?entityType=TEAM') {
        return new Response(JSON.stringify([teamOverride]), { status: 200 });
      }
      if (method === 'GET' && url.startsWith('/backend/admin/display-names?entityType=')) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    const englandGroup = await screen.findByRole('button', { name: /^England \(1\)/ });
    const spainGroup = screen.getByRole('button', { name: /^Spain \(1\)/ });
    expect(screen.queryByText('EPL')).not.toBeInTheDocument();

    await userEvent.click(englandGroup);
    expect(await screen.findByText('EPL')).toBeInTheDocument();
    expect(screen.queryByText('La Liga')).not.toBeInTheDocument();

    // Opening a second group closes the first - only one open at a time.
    await userEvent.click(spainGroup);
    expect(await screen.findByText('La Liga')).toBeInTheDocument();
    expect(screen.queryByText('EPL')).not.toBeInTheDocument();

    // Switching tabs resets the expanded group - Teams groups by letter
    // instead of country, so the country group buttons are gone too.
    await userEvent.click(screen.getByRole('button', { name: 'Teams' }));
    expect(screen.queryByRole('button', { name: /^Spain/ })).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: /^R \(1\)/ }));
    expect(await screen.findByText('Real Madrid')).toBeInTheDocument();
  });
});
