import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../features/auth/authStore';
import { useBetSlipStore } from '../features/bet-slip/betSlipStore';
import { AppShell } from './AppShell';

function renderShell() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route index element={<div>Page content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

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
  it('shows the Bet Slip button with no count when empty', () => {
    renderShell();

    expect(screen.getByRole('button', { name: 'Bet Slip' })).toBeInTheDocument();
  });

  it('shows the selection count once there are selections', () => {
    useBetSlipStore.setState({
      selections: [
        {
          matchId: 'match-1',
          marketId: 'match-result',
          selectionId: 'home',
          matchLabel: 'Arsenal vs Chelsea',
          marketName: 'Match Result',
          selectionName: 'Home',
          odds: 2.1,
        },
      ],
    });
    renderShell();

    expect(screen.getByRole('button', { name: 'Bet Slip (1)' })).toBeInTheDocument();
  });

  it('toggles the bet slip panel open and closed', async () => {
    renderShell();

    expect(screen.queryByText('Your bet slip is empty.')).not.toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: 'Bet Slip' });
    await userEvent.click(toggle);
    expect(screen.getByText('Your bet slip is empty.')).toBeInTheDocument();

    await userEvent.click(toggle);
    expect(screen.queryByText('Your bet slip is empty.')).not.toBeInTheDocument();
  });
});
