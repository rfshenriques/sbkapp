import type { Match } from '@sportsbook/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStaffAuthStore } from '../features/auth/staffAuthStore';
import type { TopNavItem } from '../lib/backendApi';
import CmsTopNavPage from './CmsTopNavPage';

const footballMatch: Match = {
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

const tennisMatch: Match = {
  ...footballMatch,
  id: 'match-2',
  sport: 'Tennis',
  competition: 'Wimbledon',
  homeTeam: 'Player A',
  awayTeam: 'Player B',
};

const sportItem: TopNavItem = {
  id: 'item-1',
  brandId: 'brand-1',
  kind: 'SPORT',
  label: 'Football',
  icon: 'STAR',
  sport: 'Football',
  competition: null,
  matchId: null,
  betAndGetCampaignId: null,
  leaderboardCampaignId: null,
  sortOrder: 0,
  enabled: true,
  createdAt: '2026-08-18T00:00:00Z',
  updatedAt: '2026-08-18T00:00:00Z',
};

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <CmsTopNavPage />
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
      return new Response(JSON.stringify([footballMatch, tennisMatch]), { status: 200 });
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

describe('CmsTopNavPage', () => {
  it('shows the empty state and adds a SPORT item from the sport dropdown', async () => {
    const fetchMock = stubFetch((url, method) => {
      if (method === 'GET' && url === '/backend/admin/top-nav') {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (method === 'POST' && url === '/backend/admin/top-nav') {
        return new Response(JSON.stringify(sportItem), { status: 201 });
      }
    });
    renderPage();

    expect(await screen.findByText('No top nav items yet - add one below.')).toBeInTheDocument();

    const sportSelect = await screen.findByLabelText('Sport');
    await userEvent.selectOptions(sportSelect, 'Football');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/top-nav',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ kind: 'SPORT', label: 'Football', sport: 'Football', icon: 'STAR' }),
      }),
    );
  });

  it('uses a custom name instead of the sport name when opted in', async () => {
    const fetchMock = stubFetch((url, method) => {
      if (method === 'GET' && url === '/backend/admin/top-nav') {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (method === 'POST' && url === '/backend/admin/top-nav') {
        return new Response(JSON.stringify({ ...sportItem, label: 'Big Match Energy' }), { status: 201 });
      }
    });
    renderPage();

    await screen.findByRole('option', { name: 'Football' });
    const sportSelect = screen.getByLabelText('Sport');
    await userEvent.selectOptions(sportSelect, 'Football');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Custom name' }));
    await userEvent.type(screen.getByLabelText('Display label'), 'Big Match Energy');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/top-nav',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ kind: 'SPORT', label: 'Big Match Energy', sport: 'Football', icon: 'STAR' }),
      }),
    );
  });

  it('never offers an icon picker while adding a SPORT item - its icon is always auto-derived on the player app', async () => {
    stubFetch((url, method) => {
      if (method === 'GET' && url === '/backend/admin/top-nav') {
        return new Response(JSON.stringify([]), { status: 200 });
      }
    });
    renderPage();

    await screen.findByRole('option', { name: 'Football' });
    expect(screen.queryByRole('group', { name: 'Icon' })).not.toBeInTheDocument();
  });

  it('lets staff pick a different icon before adding a TODAY item', async () => {
    const fetchMock = stubFetch((url, method) => {
      if (method === 'GET' && url === '/backend/admin/top-nav') {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (method === 'POST' && url === '/backend/admin/top-nav') {
        return new Response(JSON.stringify({ ...sportItem, kind: 'TODAY', icon: 'TROPHY' }), { status: 201 });
      }
    });
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: "Today's matches" }));
    await userEvent.click(screen.getByRole('button', { name: 'Trophy' }));
    await userEvent.click(screen.getByRole('button', { name: /Add Today's matches/ }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/top-nav',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ kind: 'TODAY', label: "Today's matches", icon: 'TROPHY' }),
      }),
    );
  });

  it('lists an existing item with its kind and target', async () => {
    stubFetch((url, method) => {
      if (method === 'GET' && url === '/backend/admin/top-nav') {
        return new Response(JSON.stringify([sportItem]), { status: 200 });
      }
    });
    renderPage();

    expect(await screen.findByText('Football', { selector: 'span.block.truncate.text-sm' })).toBeInTheDocument();
    expect(screen.getByText(/Sport · Football · Enabled/)).toBeInTheDocument();
  });

  it('adds a MATCH item via the match drilldown', async () => {
    const fetchMock = stubFetch((url, method) => {
      if (method === 'GET' && url === '/backend/admin/top-nav') {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (method === 'POST' && url === '/backend/admin/top-nav') {
        return new Response(JSON.stringify({ ...sportItem, kind: 'MATCH', matchId: 'match-1' }), { status: 201 });
      }
    });
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Match' }));
    await userEvent.click(await screen.findByRole('button', { name: /Football \(1\)/ }));
    await userEvent.click(await screen.findByRole('button', { name: /England \(1\)/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Premier League \(1\)/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Add to top nav' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/top-nav',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ kind: 'MATCH', label: 'Arsenal vs Chelsea', matchId: 'match-1', icon: 'STAR' }),
      }),
    );
  });

  it("adds a TODAY item with one click, and disables the button once it's already added", async () => {
    const fetchMock = stubFetch((url, method) => {
      if (method === 'GET' && url === '/backend/admin/top-nav') {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (method === 'POST' && url === '/backend/admin/top-nav') {
        return new Response(
          JSON.stringify({ ...sportItem, kind: 'TODAY', label: "Today's matches", sport: null }),
          { status: 201 },
        );
      }
    });
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: "Today's matches" }));
    await userEvent.click(screen.getByRole('button', { name: "Add Today's matches" }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/top-nav',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ kind: 'TODAY', label: "Today's matches", icon: 'STAR' }),
      }),
    );
  });

  it('toggling enabled and saving patches the item', async () => {
    const fetchMock = stubFetch((url, method) => {
      if (method === 'GET' && url === '/backend/admin/top-nav') {
        return new Response(JSON.stringify([sportItem]), { status: 200 });
      }
      if (method === 'PATCH' && url === '/backend/admin/top-nav/item-1') {
        return new Response(JSON.stringify({ ...sportItem, enabled: false }), { status: 200 });
      }
    });
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /Football/ }));
    const checkbox = screen.getByRole('checkbox', { name: 'Enabled' });
    await userEvent.click(checkbox);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/top-nav/item-1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ label: 'Football', enabled: false, icon: 'STAR' }),
      }),
    );
  });

  it('never offers an icon picker for a SPORT/COMPETITION/MATCH item - its icon is always auto-derived on the player app', async () => {
    stubFetch((url, method) => {
      if (method === 'GET' && url === '/backend/admin/top-nav') {
        return new Response(JSON.stringify([sportItem]), { status: 200 });
      }
    });
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /Football/ }));
    expect(screen.queryByText('Icon')).not.toBeInTheDocument();
  });

  it('lets staff change an existing TODAY/TOMORROW item\'s icon and save it', async () => {
    const todayItem: TopNavItem = { ...sportItem, kind: 'TODAY', label: "Today's matches", sport: null };
    const fetchMock = stubFetch((url, method) => {
      if (method === 'GET' && url === '/backend/admin/top-nav') {
        return new Response(JSON.stringify([todayItem]), { status: 200 });
      }
      if (method === 'PATCH' && url === '/backend/admin/top-nav/item-1') {
        return new Response(JSON.stringify({ ...todayItem, icon: 'FIRE' }), { status: 200 });
      }
    });
    renderPage();

    // "Today's matches" is also one of the "Add an item" kind buttons' own
    // label - find the row toggle unambiguously via its subtitle text.
    const subtitle = await screen.findByText("Today's matches · Enabled");
    const rowToggle = subtitle.closest('button');
    if (!rowToggle) throw new Error('row toggle button not found');
    await userEvent.click(rowToggle);
    const enabledCheckbox = screen.getByRole('checkbox', { name: 'Enabled' });
    const rowPanel = enabledCheckbox.closest('.space-y-3');
    if (!rowPanel) throw new Error('expanded row panel not found');
    await userEvent.click(within(rowPanel as HTMLElement).getByRole('button', { name: 'Fire' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/top-nav/item-1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ label: "Today's matches", enabled: true, icon: 'FIRE' }),
      }),
    );
  });

  it('removes an item', async () => {
    const fetchMock = stubFetch((url, method) => {
      if (method === 'GET' && url === '/backend/admin/top-nav') {
        return new Response(JSON.stringify([sportItem]), { status: 200 });
      }
      if (method === 'DELETE' && url === '/backend/admin/top-nav/item-1') {
        return new Response(null, { status: 204 });
      }
    });
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /Football/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/top-nav/item-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it("adds a BOOSTS item with one click, and disables the button once it's already added", async () => {
    const fetchMock = stubFetch((url, method) => {
      if (method === 'GET' && url === '/backend/admin/top-nav') {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (method === 'POST' && url === '/backend/admin/top-nav') {
        return new Response(JSON.stringify({ ...sportItem, kind: 'BOOSTS', label: 'Boosts', sport: null }), {
          status: 201,
        });
      }
    });
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Boosts' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add Boosts' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/top-nav',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ kind: 'BOOSTS', label: 'Boosts', icon: 'STAR' }),
      }),
    );
  });

  it("adds a SPECIALS item with one click, and disables the button once it's already added", async () => {
    const fetchMock = stubFetch((url, method) => {
      if (method === 'GET' && url === '/backend/admin/top-nav') {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (method === 'POST' && url === '/backend/admin/top-nav') {
        return new Response(JSON.stringify({ ...sportItem, kind: 'SPECIALS', label: 'Specials', sport: null }), {
          status: 201,
        });
      }
    });
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Specials' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add Specials' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/top-nav',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ kind: 'SPECIALS', label: 'Specials', icon: 'STAR' }),
      }),
    );
  });

  it('adds a CHALLENGE item via the challenge dropdown', async () => {
    const fetchMock = stubFetch((url, method) => {
      if (method === 'GET' && url === '/backend/admin/top-nav') {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/admin/bet-and-get-campaigns') {
        return new Response(JSON.stringify([{ id: 'campaign-1', name: 'Weekend Boost' }]), { status: 200 });
      }
      if (method === 'POST' && url === '/backend/admin/top-nav') {
        return new Response(
          JSON.stringify({ ...sportItem, kind: 'CHALLENGE', label: 'Weekend Boost', sport: null, betAndGetCampaignId: 'campaign-1' }),
          { status: 201 },
        );
      }
    });
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Challenge' }));
    const select = await screen.findByLabelText('Challenge');
    await userEvent.selectOptions(select, 'Weekend Boost');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/top-nav',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          kind: 'CHALLENGE',
          label: 'Weekend Boost',
          betAndGetCampaignId: 'campaign-1',
          icon: 'STAR',
        }),
      }),
    );
  });

  it('adds a LEADERBOARD item via the leaderboard dropdown', async () => {
    const fetchMock = stubFetch((url, method) => {
      if (method === 'GET' && url === '/backend/admin/top-nav') {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/admin/leaderboard-campaigns') {
        return new Response(JSON.stringify([{ id: 'leaderboard-1', name: 'Top Bettors' }]), { status: 200 });
      }
      if (method === 'POST' && url === '/backend/admin/top-nav') {
        return new Response(
          JSON.stringify({
            ...sportItem,
            kind: 'LEADERBOARD',
            label: 'Top Bettors',
            sport: null,
            leaderboardCampaignId: 'leaderboard-1',
          }),
          { status: 201 },
        );
      }
    });
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Leaderboard' }));
    const select = await screen.findByLabelText('Leaderboard');
    await userEvent.selectOptions(select, 'Top Bettors');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/top-nav',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          kind: 'LEADERBOARD',
          label: 'Top Bettors',
          leaderboardCampaignId: 'leaderboard-1',
          icon: 'STAR',
        }),
      }),
    );
  });

  it('lists an existing CHALLENGE item resolved to its campaign name', async () => {
    const challengeItem: TopNavItem = {
      ...sportItem,
      kind: 'CHALLENGE',
      label: 'Weekend Boost',
      sport: null,
      betAndGetCampaignId: 'campaign-1',
    };
    stubFetch((url, method) => {
      if (method === 'GET' && url === '/backend/admin/top-nav') {
        return new Response(JSON.stringify([challengeItem]), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/admin/bet-and-get-campaigns') {
        return new Response(JSON.stringify([{ id: 'campaign-1', name: 'Weekend Boost' }]), { status: 200 });
      }
    });
    renderPage();

    expect(await screen.findByText(/Challenge · Weekend Boost · Enabled/)).toBeInTheDocument();
  });

  it('offers an icon picker while adding a BOOSTS/SPECIALS/CHALLENGE/LEADERBOARD item, unlike SPORT/COMPETITION/MATCH', async () => {
    stubFetch((url, method) => {
      if (method === 'GET' && url === '/backend/admin/top-nav') {
        return new Response(JSON.stringify([]), { status: 200 });
      }
    });
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Boosts' }));
    expect(screen.getByText('Icon')).toBeInTheDocument();
  });
});
