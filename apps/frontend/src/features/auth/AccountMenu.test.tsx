import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from './authStore';
import { useDepositModalStore } from '../deposit/depositModalStore';
import { AccountMenu } from './AccountMenu';

function stubFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/backend/wallet') {
        return new Response(JSON.stringify({ balanceCents: 5000 }), { status: 200 });
      }
      if (url === '/backend/freebets') {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (url === '/backend/push/subscribe') {
        return new Response(JSON.stringify({}), { status: 200 });
      }
      if (url === '/backend/public/push/vapid-public-key') {
        return new Response(JSON.stringify({ publicKey: 'dGVzdC12YXBpZC1rZXk' }), { status: 200 });
      }
      return new Response(null, { status: 404 });
    }),
  );
}

function renderMenu() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AccountMenu />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useAuthStore.setState({
    accessToken: 'header.payload.signature',
    user: { sub: 'user-1', username: 'player1', email: 'player1@example.com' },
    isInitialized: true,
  });
  useDepositModalStore.setState({ isOpen: false });
  stubFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AccountMenu', () => {
  it('opens a full-screen account modal (not a floating dropdown) showing the player identity and balance', async () => {
    renderMenu();

    await userEvent.click(screen.getByRole('button', { name: 'Account' }));

    expect(screen.getByText('player1')).toBeInTheDocument();
    expect(screen.getByText('player1@example.com')).toBeInTheDocument();
    expect(await screen.findByText('50.00 €')).toBeInTheDocument();
  });

  it('only shows real destinations: My Bets, Responsible Gambling, Settings, Add funds, Log out', async () => {
    renderMenu();

    await userEvent.click(screen.getByRole('button', { name: 'Account' }));

    // My Bets is a real route (also a primary bottom-nav destination) -
    // Responsible Gambling and Settings open as sub-views inside this same
    // sheet instead (see the next test), so they're buttons, not links.
    expect(screen.getByRole('link', { name: /my bets/i })).toHaveAttribute('href', '/my-bets');
    expect(screen.getByRole('button', { name: /responsible gambling/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add funds' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
  });

  it('opens Settings as a sub-view inside the same sheet, with a back button that returns to the menu', async () => {
    renderMenu();

    await userEvent.click(screen.getByRole('button', { name: 'Account' }));
    await userEvent.click(screen.getByRole('button', { name: 'Settings' }));

    // The menu content (player identity) is gone, replaced by the settings view.
    expect(screen.queryByText('player1')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByText('Appearance')).toBeInTheDocument();
    // Log out is menu-only chrome - it shouldn't follow into a sub-view.
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Back to account menu' }));

    expect(screen.getByText('player1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Account' })).toBeInTheDocument();
  });

  it('opens Responsible Gambling as a sub-view, and the X still closes the whole sheet from inside it', async () => {
    renderMenu();

    await userEvent.click(screen.getByRole('button', { name: 'Account' }));
    await userEvent.click(screen.getByRole('button', { name: 'Responsible Gambling' }));

    expect(screen.getByRole('heading', { name: 'Responsible Gambling' })).toBeInTheDocument();

    const closeButtons = screen.getAllByRole('button', { name: 'Close account' });
    await userEvent.click(closeButtons[closeButtons.length - 1]!);

    expect(screen.queryByRole('heading', { name: 'Responsible Gambling' })).not.toBeInTheDocument();
  });

  it('opens the deposit modal and closes itself when Add funds is clicked', async () => {
    renderMenu();

    await userEvent.click(screen.getByRole('button', { name: 'Account' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add funds' }));

    expect(useDepositModalStore.getState().isOpen).toBe(true);
    expect(screen.queryByText('player1')).not.toBeInTheDocument();
  });

  it('closes on backdrop click', async () => {
    renderMenu();

    await userEvent.click(screen.getByRole('button', { name: 'Account' }));
    expect(screen.getByText('player1')).toBeInTheDocument();

    const closeButtons = screen.getAllByRole('button', { name: 'Close account' });
    await userEvent.click(closeButtons[closeButtons.length - 1]!);
    expect(screen.queryByText('player1')).not.toBeInTheDocument();
  });

  it('hides the push notifications toggle when the browser has no PushManager/serviceWorker support', async () => {
    renderMenu();

    await userEvent.click(screen.getByRole('button', { name: 'Account' }));

    expect(screen.queryByRole('switch', { name: 'Push notifications' })).not.toBeInTheDocument();
  });

  it('shows and can toggle push notifications when the browser supports it', async () => {
    const getSubscription = vi.fn().mockResolvedValue(null);
    const subscribe = vi.fn().mockResolvedValue({
      toJSON: () => ({ endpoint: 'https://push.example.com/ep', keys: { p256dh: 'p', auth: 'a' } }),
    });
    vi.stubGlobal('navigator', {
      ...navigator,
      serviceWorker: { ready: Promise.resolve({ pushManager: { getSubscription, subscribe } }) },
    });
    vi.stubGlobal('PushManager', class {});
    vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue('granted'), permission: 'default' });

    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: 'Account' }));

    const toggle = await screen.findByRole('switch', { name: 'Push notifications' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    await userEvent.click(toggle);

    expect(subscribe).toHaveBeenCalled();
  });

  it('shows a blocked-at-device message instead of silently no-oping when permission is already denied', async () => {
    const getSubscription = vi.fn().mockResolvedValue(null);
    const subscribe = vi.fn();
    vi.stubGlobal('navigator', {
      ...navigator,
      serviceWorker: { ready: Promise.resolve({ pushManager: { getSubscription, subscribe } }) },
    });
    vi.stubGlobal('PushManager', class {});
    vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue('denied'), permission: 'denied' });

    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: 'Account' }));

    const toggle = await screen.findByRole('switch', { name: 'Push notifications' });
    await userEvent.click(toggle);

    expect(subscribe).not.toHaveBeenCalled();
    expect(await screen.findByText(/blocked for this app at the device level/)).toBeInTheDocument();
  });
});
