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

  it('only shows real destinations: My Bets, Responsible Gambling, Add funds, Log out', async () => {
    renderMenu();

    await userEvent.click(screen.getByRole('button', { name: 'Account' }));

    expect(screen.getByRole('link', { name: /my bets/i })).toHaveAttribute('href', '/my-bets');
    expect(screen.getByRole('link', { name: /responsible gambling/i })).toHaveAttribute(
      'href',
      '/responsible-gambling',
    );
    expect(screen.getByRole('button', { name: 'Add funds' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
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
});
