import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubOddsEngineFetch } from '../test/mockOddsEngine';
import { useBetSlipStore } from '../features/bet-slip/betSlipStore';
import OddsBoardPage from './OddsBoardPage';

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <OddsBoardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function renderPageWithRouting() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<OddsBoardPage />} />
          <Route path="/matches/:matchId" element={<p>Match detail page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  stubOddsEngineFetch();
  useBetSlipStore.setState({ selections: [] });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OddsBoardPage', () => {
  it('shows a loading skeleton before matches resolve, then renders the matches', async () => {
    renderPage();

    expect(screen.getByRole('status', { name: 'Loading matches' })).toBeInTheDocument();

    expect(await screen.findByText('Arsenal vs Chelsea')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Loading matches' })).not.toBeInTheDocument();
  });

  it('navigates to the featured match when clicking anywhere on its card', async () => {
    renderPageWithRouting();

    // mockMatches' only live fixture (Real Madrid vs Barcelona) sorts first.
    await screen.findByText('Real Madrid vs Barcelona');
    // "Live now" only appears once, in the featured card's own badge.
    await userEvent.click(screen.getByText('Live now'));

    expect(await screen.findByText('Match detail page')).toBeInTheDocument();
  });

  it('does not navigate when picking an odd on the featured card', async () => {
    renderPageWithRouting();

    await screen.findByText('Real Madrid vs Barcelona');
    const oddsButtons = screen.getAllByRole('button', { name: /Home/ });
    await userEvent.click(oddsButtons[0] as HTMLElement);

    expect(screen.queryByText('Match detail page')).not.toBeInTheDocument();
    expect(useBetSlipStore.getState().selections).toHaveLength(1);
  });
});
