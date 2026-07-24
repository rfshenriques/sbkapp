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

const hoffenheim: TeamColor = {
  id: 'team-3',
  name: '1899 Hoffenheim',
  colorHex: null,
  createdAt: '2026-07-18T00:00:00Z',
  updatedAt: '2026-07-18T00:00:00Z',
};

const nineElms: TeamColor = {
  id: 'team-4',
  name: '96 Athletic',
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

    // Grouped by letter by default, each group collapsed until opened -
    // Arsenal and Chelsea land in different ("A"/"C") groups.
    await userEvent.click(await screen.findByRole('button', { name: /^A \(1\)/ }));
    expect(await screen.findByText('Arsenal')).toBeInTheDocument();
    expect(screen.getByLabelText('Arsenal color hex')).toHaveValue('#EF0107');

    await userEvent.click(screen.getByRole('button', { name: /^C \(1\)/ }));
    expect(await screen.findByText('Chelsea')).toBeInTheDocument();
    expect(screen.getByLabelText('Chelsea color hex')).toHaveValue('');
  });

  it('groups teams by letter or by country, one group expanded at a time', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'GET' && url === '/api/events') {
        return new Response(JSON.stringify([liveMatch]), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/admin/team-colors') {
        return new Response(JSON.stringify([arsenal, chelsea]), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderTeamColorsPage();

    const groupA = await screen.findByRole('button', { name: /^A \(1\)/ });
    const groupC = screen.getByRole('button', { name: /^C \(1\)/ });
    expect(screen.queryByText('Arsenal')).not.toBeInTheDocument();

    await userEvent.click(groupA);
    expect(await screen.findByText('Arsenal')).toBeInTheDocument();

    // Opening a second group closes the first - only one open at a time.
    await userEvent.click(groupC);
    expect(await screen.findByText('Chelsea')).toBeInTheDocument();
    expect(screen.queryByText('Arsenal')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'By country' }));
    expect(screen.queryByText('Chelsea')).not.toBeInTheDocument();
    const englandGroup = await screen.findByRole('button', { name: /^England \(2\)/ });
    await userEvent.click(englandGroup);
    expect(await screen.findByText('Arsenal')).toBeInTheDocument();
    expect(await screen.findByText('Chelsea')).toBeInTheDocument();
  });

  it('buckets every digit-led team name into one combined "0-9" group, sorted after Z', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (method === 'GET' && url === '/api/events') {
        return new Response(JSON.stringify([liveMatch]), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/admin/team-colors') {
        return new Response(JSON.stringify([arsenal, hoffenheim, nineElms]), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderTeamColorsPage();

    const groupA = await screen.findByRole('button', { name: /^A \(1\)/ });
    const numericGroup = await screen.findByRole('button', { name: /^0-9 \(2\)/ });
    expect(screen.queryByRole('button', { name: /^1 \(/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^9 \(/ })).not.toBeInTheDocument();

    const buttons = screen.getAllByRole('button', { name: /^(A|0-9) \(/ });
    expect(buttons.indexOf(groupA)).toBeLessThan(buttons.indexOf(numericGroup));

    await userEvent.click(numericGroup);
    expect(await screen.findByText('1899 Hoffenheim')).toBeInTheDocument();
    expect(screen.getByText('96 Athletic')).toBeInTheDocument();
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
    await userEvent.click(await screen.findByRole('button', { name: /^C \(1\)/ }));
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
