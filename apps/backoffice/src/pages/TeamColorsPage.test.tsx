import type { Match } from '@sportsbook/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStaffAuthStore } from '../features/auth/staffAuthStore';
import type { TeamColor } from '../lib/backendApi';
import TeamColorsPage from './TeamColorsPage';

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

const arsenal: TeamColor = {
  id: 'team-1',
  name: 'Arsenal',
  colorHex: '#EF0107',
  createdAt: '2026-07-18T00:00:00Z',
  updatedAt: '2026-07-18T00:00:00Z',
};

const chelsea: TeamColor = {
  id: 'team-2',
  name: 'Chelsea',
  colorHex: null,
  createdAt: '2026-07-18T00:00:00Z',
  updatedAt: '2026-07-18T00:00:00Z',
};

function renderTeamColorsPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <TeamColorsPage />
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

describe('TeamColorsPage', () => {
  it('syncs team names seen in the live odds feed, then lists the resulting rows', async () => {
    let teamColors: TeamColor[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'GET' && url === '/api/events') {
        return new Response(JSON.stringify([liveMatch]), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/admin/team-colors') {
        return new Response(JSON.stringify(teamColors), { status: 200 });
      }
      if (method === 'POST' && url === '/backend/admin/team-colors/sync') {
        expect(JSON.parse(init!.body as string)).toEqual({ names: ['Arsenal', 'Chelsea'] });
        teamColors = [arsenal, chelsea];
        return new Response(JSON.stringify(teamColors), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderTeamColorsPage();

    expect(await screen.findByText('Arsenal')).toBeInTheDocument();
    expect(await screen.findByText('Chelsea')).toBeInTheDocument();
    expect(screen.getByLabelText('Arsenal color hex')).toHaveValue('#EF0107');
    expect(screen.getByLabelText('Chelsea color hex')).toHaveValue('');
  });

  it('setting a color sends the right request and disables Save until a change is made', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'GET' && url === '/api/events') {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/admin/team-colors') {
        return new Response(JSON.stringify([chelsea]), { status: 200 });
      }
      if (method === 'PATCH' && url === '/backend/admin/team-colors/team-2') {
        expect(JSON.parse(init!.body as string)).toEqual({ colorHex: '#034694' });
        return new Response(JSON.stringify({ ...chelsea, colorHex: '#034694' }), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderTeamColorsPage();
    await screen.findByText('Chelsea');

    const saveButton = screen.getByRole('button', { name: 'Save' });
    expect(saveButton).toBeDisabled();

    const input = screen.getByLabelText('Chelsea color hex');
    await userEvent.type(input, '#034694');
    expect(saveButton).toBeEnabled();

    await userEvent.click(saveButton);

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/team-colors/team-2',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });
});
