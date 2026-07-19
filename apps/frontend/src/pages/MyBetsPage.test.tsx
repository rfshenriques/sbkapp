import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../features/auth/authStore';
import MyBetsPage from './MyBetsPage';

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MyBetsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MyBetsPage', () => {
  it('prompts to log in when not authenticated', () => {
    useAuthStore.setState({ accessToken: null, user: null, isInitialized: true });
    renderPage();

    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
  });

  it('shows the bet history when authenticated', async () => {
    useAuthStore.setState({
      accessToken: 'header.payload.signature',
      user: null,
      isInitialized: true,
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 })));

    renderPage();

    expect(await screen.findByText('No bets placed yet')).toBeInTheDocument();
  });
});
