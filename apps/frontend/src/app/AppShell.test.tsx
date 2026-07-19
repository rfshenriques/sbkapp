import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../features/auth/authStore';
import { useBetSlipStore } from '../features/bet-slip/betSlipStore';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import { AppShell } from './AppShell';

// Login/register are real routes (see routes.ts) rather than plain
// placeholders - the forced-login-on-load behavior navigates to /login,
// and without a matching route the whole AppShell (a layout route) would
// fail to match and disappear entirely.
function renderShell(initialEntries: string[] = ['/']) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route index element={<div>Page content</div>} />
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
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
  useBetSlipStore.setState({ selections: [] });
  useAuthStore.setState({ accessToken: null, user: null, isInitialized: false });
  // Not logged in by default - the silent-refresh call on mount finds no session.
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AppShell', () => {
  it('always renders the bet slip panel (desktop persistent panel), even when empty', () => {
    renderShell();

    // Desktop's persistent panel uses the fuller, promotional empty state.
    expect(screen.getByText('Add selections to your bet slip')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse matches' })).toBeInTheDocument();
  });

  it('the desktop panel shows a Bet Slip / History tab pair', () => {
    renderShell();

    expect(screen.getByRole('tab', { name: 'Bet Slip' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Bet History' })).toBeInTheDocument();
  });

  it('has Home, Live, My Bets, and Promotions links plus a Search button in the mobile bottom nav', () => {
    renderShell();

    const nav = screen.getByRole('navigation', { name: 'App navigation' });
    expect(within(nav).getByRole('link', { name: /Home/ })).toHaveAttribute('href', '/');
    expect(within(nav).getByRole('link', { name: /Live/ })).toHaveAttribute('href', '/live');
    expect(within(nav).getByRole('link', { name: /My Bets/ })).toHaveAttribute('href', '/my-bets');
    expect(within(nav).getByRole('link', { name: /Promotions/ })).toHaveAttribute(
      'href',
      '/promotions',
    );
    expect(within(nav).getByRole('button', { name: /Search/ })).toBeInTheDocument();
  });

  it('does not show the mobile floating bar when the slip is empty', () => {
    renderShell();

    expect(screen.queryByText('Single')).not.toBeInTheDocument();
    expect(screen.queryByText('Accumulator')).not.toBeInTheDocument();
  });

  it('the mobile floating bar reads "Single" with that one odd aligned to the right for exactly one selection', () => {
    useBetSlipStore.setState({ selections: [homeSelection] });
    renderShell();

    const floatingBar = screen.getByRole('button', { name: /Single/ });
    expect(floatingBar).toHaveTextContent('Single');
    expect(floatingBar).toHaveTextContent('2.10');
  });

  it('the mobile floating bar reads "Accumulator" with the combined odds for 2+ selections', () => {
    useBetSlipStore.setState({ selections: [homeSelection, awaySelection] });
    renderShell();

    // 2.1 * 2.5 = 5.25
    const floatingBar = screen.getByRole('button', { name: /Accumulator/ });
    expect(floatingBar).toHaveTextContent('Accumulator');
    expect(floatingBar).toHaveTextContent('5.25');
  });

  it('clicking the mobile floating bar opens the bet slip modal', async () => {
    useBetSlipStore.setState({ selections: [homeSelection] });
    renderShell();

    await userEvent.click(screen.getByRole('button', { name: /Single/ }));

    // Two elements share this label: the backdrop and the modal's own ✕ button.
    expect(screen.getAllByRole('button', { name: 'Close bet slip' }).length).toBeGreaterThan(0);
  });

  it('the desktop sports navigation column is always rendered', async () => {
    renderShell();

    expect(await screen.findByRole('navigation', { name: 'Sports navigation' })).toBeInTheDocument();
  });

  it('clicking the mobile bottom-nav Search button opens the sports navigation drawer', async () => {
    renderShell();

    const nav = screen.getByRole('navigation', { name: 'App navigation' });
    await userEvent.click(within(nav).getByRole('button', { name: /Search/ }));

    expect(screen.getAllByRole('button', { name: 'Close sports navigation' }).length).toBeGreaterThan(0);
  });

  it('does not show a hamburger button in the header - only the logo', () => {
    renderShell();

    expect(screen.queryByRole('button', { name: 'Open sports navigation' })).not.toBeInTheDocument();
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
});
