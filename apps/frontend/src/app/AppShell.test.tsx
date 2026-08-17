import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../features/auth/authStore';
import { useAuthModalStore } from '../features/auth/authModalStore';
import { useBetPlacedModalStore } from '../features/bet-slip/betPlacedModalStore';
import { useBetSlipSheetStore } from '../features/bet-slip/betSlipSheetStore';
import { useBetSlipStore } from '../features/bet-slip/betSlipStore';
import { useBrandStore } from '../features/brand/brandStore';
import { RegisterDeepLink } from '../features/auth/AuthDeepLink';
import { AppShell } from './AppShell';

// Login/register are no longer routes AppShell's Outlet swaps to (see
// authModalStore.ts) - AppShell renders them itself as an overlay based on
// the store's mode, alongside whatever the Outlet is currently showing.
// /register is kept here only to exercise the deep-link redirect (see
// AuthDeepLink.tsx).
function renderShell(initialEntries: string[] = ['/']) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route index element={<div>Page content</div>} />
            <Route path="register" element={<RegisterDeepLink />} />
            <Route path="live" element={<div>Live page content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const homeSelection = {
  matchId: 'match-1',
  marketId: 'match-result',
  selectionId: 'home',
  matchLabel: 'Arsenal vs Chelsea',
  marketName: 'Match Result',
  selectionName: 'Home',
  odds: 2.1,
};

const awaySelection = {
  matchId: 'match-2',
  marketId: 'match-result',
  selectionId: 'away',
  matchLabel: 'Liverpool vs Manchester City',
  marketName: 'Match Result',
  selectionName: 'Away',
  odds: 2.5,
};

beforeEach(() => {
  useBetSlipStore.setState({ selections: [], stake: '10.00', singleStakes: {} });
  useBetSlipSheetStore.setState({ isOpen: false });
  useAuthStore.setState({ accessToken: null, user: null, isInitialized: false });
  useAuthModalStore.setState({ mode: null });
  useBetPlacedModalStore.setState({ summary: null });
  useBrandStore.setState({ brandId: undefined });
  // Not logged in by default - the silent-refresh call on mount finds no session.
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AppShell', () => {
  it('always renders the bet slip panel (desktop persistent panel), even when empty', async () => {
    renderShell();

    // Desktop's persistent panel uses the fuller, promotional empty state.
    expect(await screen.findByText('Add selections to your bet slip')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse matches' })).toBeInTheDocument();
  });

  it('the desktop panel shows a Bet Slip / History tab pair', async () => {
    renderShell();

    expect(await screen.findByRole('tab', { name: 'Bet Slip' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Bet History' })).toBeInTheDocument();
  });

  it('has Highlights, Live, My Bets, and Challenges links plus a Search button in the mobile bottom nav', async () => {
    renderShell();

    const nav = await screen.findByRole('navigation', { name: 'App navigation' });
    expect(within(nav).getByRole('link', { name: /Highlights/ })).toHaveAttribute('href', '/');
    expect(within(nav).getByRole('link', { name: /Live/ })).toHaveAttribute('href', '/live');
    expect(within(nav).getByRole('link', { name: /My Bets/ })).toHaveAttribute('href', '/my-bets');
    expect(within(nav).getByRole('link', { name: /Challenges/ })).toHaveAttribute(
      'href',
      '/challenges',
    );
    expect(within(nav).getByRole('button', { name: /Search/ })).toBeInTheDocument();
  });

  it('does not show the mobile floating bar when the slip is empty', () => {
    renderShell();

    expect(screen.queryByText('Single')).not.toBeInTheDocument();
    expect(screen.queryByText('Accumulator')).not.toBeInTheDocument();
  });

  it('the mobile floating bar reads "Single" with that one odd aligned to the right for exactly one selection', async () => {
    useBetSlipStore.setState({ selections: [homeSelection] });
    renderShell();

    const floatingBar = await screen.findByRole('button', { name: /Single/ });
    expect(floatingBar).toHaveTextContent('Single');
    expect(floatingBar).toHaveTextContent('2.10');
  });

  it('the mobile floating bar reads "Accumulator" with the combined odds for 2+ selections', async () => {
    useBetSlipStore.setState({ selections: [homeSelection, awaySelection] });
    renderShell();

    // 2.1 * 2.5 = 5.25
    const floatingBar = await screen.findByRole('button', { name: /Accumulator/ });
    expect(floatingBar).toHaveTextContent('Accumulator');
    expect(floatingBar).toHaveTextContent('5.25');
  });

  it('the mobile floating bar reads "Singles" with a slash for two selections from the same event', async () => {
    const totalGoalsSelection = {
      ...homeSelection,
      marketId: 'total-goals',
      marketName: 'Total Goals',
      selectionId: 'over',
      selectionName: 'Over 2.5',
    };
    useBetSlipStore.setState({ selections: [homeSelection, totalGoalsSelection] });
    renderShell();

    const floatingBar = await screen.findByRole('button', { name: /Singles/ });
    expect(floatingBar).toHaveTextContent('Singles');
    expect(floatingBar).toHaveTextContent('/');
    expect(floatingBar).not.toHaveTextContent('Accumulator');
  });

  it('clicking the mobile floating bar opens the bet slip modal', async () => {
    useBetSlipStore.setState({ selections: [homeSelection] });
    renderShell();

    await userEvent.click(await screen.findByRole('button', { name: /Single/ }));

    // Two elements share this label: the backdrop and the modal's own ✕ button.
    expect(screen.getAllByRole('button', { name: 'Close bet slip' }).length).toBeGreaterThan(0);
  });

  it('does not show the tablet-width floating trigger when the slip is empty', () => {
    renderShell();

    expect(screen.queryByRole('button', { name: 'Open bet slip' })).not.toBeInTheDocument();
  });

  it('shows a tablet-width floating trigger, separate from the mobile bar, that opens the bet slip', async () => {
    useBetSlipStore.setState({ selections: [homeSelection] });
    renderShell();

    const tabletTrigger = await screen.findByRole('button', { name: 'Open bet slip' });
    expect(tabletTrigger).toHaveTextContent('Bet Slip');

    await userEvent.click(tabletTrigger);

    expect(useBetSlipSheetStore.getState().isOpen).toBe(true);
  });

  it('auto-closes the mobile bet slip sheet once a bet is placed, so the confirmation is not stacked on top of it', async () => {
    useBetSlipStore.setState({ selections: [homeSelection] });
    renderShell();

    await userEvent.click(await screen.findByRole('button', { name: /Single/ }));
    expect(screen.getAllByRole('button', { name: 'Close bet slip' }).length).toBeGreaterThan(0);

    useBetPlacedModalStore.setState({
      summary: {
        stakeCents: 1000,
        potentialPayoutCents: 2100,
        combinedOdds: 2.1,
        betCount: 1,
        betAndGetCampaignName: null,
        betAndGetCampaignRewardCents: null,
        depositCampaignName: null,
        depositCampaignRewardCents: null,
        registerCampaignName: null,
        registerCampaignRewardCents: null,
      },
    });

    await waitFor(() => expect(screen.queryAllByRole('button', { name: 'Close bet slip' })).toHaveLength(0));
  });

  it('the desktop sports navigation column is always rendered', async () => {
    renderShell();

    expect(await screen.findByRole('navigation', { name: 'Sports navigation' })).toBeInTheDocument();
  });

  it('clicking the mobile bottom-nav Search button opens the sports navigation drawer', async () => {
    renderShell();

    const nav = await screen.findByRole('navigation', { name: 'App navigation' });
    await userEvent.click(within(nav).getByRole('button', { name: /Search/ }));

    // The persistent desktop Sidebar column always renders one copy of its
    // own search box - a second one (the mobile drawer's own Sidebar
    // instance) appearing means the drawer opened. No heading of its own
    // (removed per design) - the search box is the drawer's own content.
    expect(screen.getAllByPlaceholderText('Search teams, competitions...')).toHaveLength(2);
  });

  it('clicking the Search button again closes the drawer, with no separate close button', async () => {
    renderShell();

    const nav = await screen.findByRole('navigation', { name: 'App navigation' });
    const searchButton = within(nav).getByRole('button', { name: /Search/ });
    await userEvent.click(searchButton);
    expect(screen.getAllByPlaceholderText('Search teams, competitions...')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /close sports/i })).not.toBeInTheDocument();

    await userEvent.click(searchButton);
    expect(screen.getAllByPlaceholderText('Search teams, competitions...')).toHaveLength(1);
  });

  it('clicking another bottom-nav tab while the drawer is open closes it and navigates', async () => {
    renderShell();

    const nav = await screen.findByRole('navigation', { name: 'App navigation' });
    await userEvent.click(within(nav).getByRole('button', { name: /Search/ }));
    expect(screen.getAllByPlaceholderText('Search teams, competitions...')).toHaveLength(2);

    await userEvent.click(within(nav).getByRole('link', { name: /Live/ }));
    expect(screen.getAllByPlaceholderText('Search teams, competitions...')).toHaveLength(1);
  });

  it('does not show a hamburger button in the header - only the logo', async () => {
    renderShell();
    await screen.findByRole('navigation', { name: 'App navigation' });

    expect(screen.queryByRole('button', { name: 'Open sports navigation' })).not.toBeInTheDocument();
  });

  describe('boot screen', () => {
    it('shows a neutral spinner (no generic brand name/colors) while the brand fetch is in flight, then the real app once it settles', async () => {
      let resolveBrandFetch: ((response: Response) => void) | undefined;
      vi.stubGlobal(
        'fetch',
        vi.fn((input: RequestInfo | URL) => {
          const url = typeof input === 'string' ? input : input.toString();
          if (url.includes('/public/brands/by-domain/')) {
            return new Promise<Response>((resolve) => {
              resolveBrandFetch = resolve;
            });
          }
          return Promise.resolve(new Response(null, { status: 401 }));
        }),
      );

      renderShell();

      expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
      expect(screen.queryByText('Sportsbook')).not.toBeInTheDocument();
      expect(screen.queryByRole('navigation', { name: 'App navigation' })).not.toBeInTheDocument();

      resolveBrandFetch!(new Response(null, { status: 404 }));

      await screen.findByRole('navigation', { name: 'App navigation' });
      expect(screen.queryByRole('status', { name: 'Loading' })).not.toBeInTheDocument();
    });
  });

  describe('forced login on load', () => {
    it('opens the login sheet once the silent-refresh bootstrap finds no session', async () => {
      renderShell();

      expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    });

    it('does not open the login sheet when a session is already restored', async () => {
      // Only the silent-refresh call needs a real answer here - everything
      // else (wallet, brand theme, sidebar matches) AppShell also fetches
      // once mounted, and those already degrade gracefully to "no data" on
      // a 404 the same way the other tests' default 401 stub does.
      const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/auth/refresh')) {
          return new Response(
            JSON.stringify({ accessToken: 'header.payload.signature' }),
            { status: 200 },
          );
        }
        return new Response(null, { status: 404 });
      });
      vi.stubGlobal('fetch', fetchMock);

      renderShell();

      await screen.findByText('Page content');
      expect(screen.queryByRole('heading', { name: 'Log in' })).not.toBeInTheDocument();
    });

    it('does not bounce a player who deep-linked straight to Register', async () => {
      renderShell(['/register']);

      expect(await screen.findByRole('heading', { name: 'Create your account' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Log in' })).not.toBeInTheDocument();
    });

    it('stays closed after the player dismisses it - closing does not reopen it', async () => {
      renderShell();
      await screen.findByRole('heading', { name: 'Log in' });

      await userEvent.click(screen.getAllByRole('button', { name: 'Close login' })[0] as HTMLElement);

      expect(await screen.findByText('Page content')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Log in' })).not.toBeInTheDocument();
    });
  });

  describe('gift badge for available campaign rewards', () => {
    function stubBrandFetch(handleOther: (url: string, method: string) => Response | undefined) {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = typeof input === 'string' ? input : input.toString();
          const method = init?.method ?? 'GET';
          if (url.includes('/public/brands/by-domain/')) {
            return new Response(
              JSON.stringify({
                id: 'brand-1',
                name: 'Sportsbook',
                logoLightUrl: null,
                logoDarkUrl: null,
                shareLogoLightUrl: null,
                shareLogoDarkUrl: null,
                themeMode: 'DARK',
                backgroundColor: null,
                buttonColor: null,
                highlightColor: null,
                filterColor: null,
                textColor: null,
                supportHelplineText: null,
              }),
              { status: 200 },
            );
          }
          return handleOther(url, method) ?? new Response(null, { status: 401 });
        }),
      );
    }

    it('shows a gift badge on the mobile floating pill when the current bet qualifies for a campaign', async () => {
      useBetSlipStore.setState({ selections: [homeSelection], stake: '10.00', singleStakes: {} });
      stubBrandFetch((url, method) => {
        if (method === 'POST' && url === '/backend/public/campaign-preview/brand-1') {
          return new Response(
            JSON.stringify({
              betAndGetCampaignName: 'CL Bet & Get',
              betAndGetCampaignRewardCents: 1000,
              depositCampaignName: null,
              depositCampaignRewardCents: null,
            }),
            { status: 200 },
          );
        }
        return undefined;
      });

      renderShell();

      // Two floating-pill copies exist now (mobile and tablet-width, see
      // AppShell) - either carries the badge identically.
      expect((await screen.findAllByTitle('This bet qualifies for a campaign reward')).length).toBeGreaterThan(0);
    });

    it('does not show a gift badge on the floating pill when the current bet qualifies for no campaign', async () => {
      useBetSlipStore.setState({ selections: [homeSelection], stake: '10.00', singleStakes: {} });
      stubBrandFetch((url, method) => {
        if (method === 'POST' && url === '/backend/public/campaign-preview/brand-1') {
          return new Response(
            JSON.stringify({
              betAndGetCampaignName: null,
              betAndGetCampaignRewardCents: null,
              depositCampaignName: null,
              depositCampaignRewardCents: null,
            }),
            { status: 200 },
          );
        }
        return undefined;
      });

      renderShell();

      await screen.findByRole('button', { name: /Single/ });
      expect(screen.queryByTitle('This bet qualifies for a campaign reward')).not.toBeInTheDocument();
    });

    it('shows a gift badge on the header cash pill when the player has an eligible deposit campaign', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL) => {
          const url = typeof input === 'string' ? input : input.toString();
          if (url.includes('/auth/refresh')) {
            return new Response(
              JSON.stringify({ accessToken: 'header.payload.signature' }),
              { status: 200 },
            );
          }
          if (url.includes('/wallet')) {
            return new Response(JSON.stringify({ balanceCents: 5000 }), { status: 200 });
          }
          if (url.includes('/deposit-campaigns/eligible')) {
            return new Response(
              JSON.stringify({
                id: 'deposit-campaign-1',
                name: 'First Deposit Bonus',
                description: null,
                minDepositAmountCents: 1_000,
                rewardType: 'FIXED',
                fixedRewardAmountCents: 500,
                rewardPercent: null,
                rewardCapCents: null,
              }),
              { status: 200 },
            );
          }
          return new Response(null, { status: 404 });
        }),
      );

      renderShell();

      expect(await screen.findByTitle('A deposit bonus is available')).toBeInTheDocument();
    });

    it('does not show a gift badge on the header cash pill when the player is not logged in', async () => {
      renderShell();

      await screen.findByRole('heading', { name: 'Log in' });
      expect(screen.queryByTitle('A deposit bonus is available')).not.toBeInTheDocument();
    });
  });
});
