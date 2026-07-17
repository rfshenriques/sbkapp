import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import MatchDetailPage from './MatchDetailPage';

function renderAt(matchId: string) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/matches/${matchId}`]}>
        <Routes>
          <Route path="/matches/:matchId" element={<MatchDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MatchDetailPage', () => {
  it('shows a loading state, then the match details, for a known match id', async () => {
    renderAt('match-1');

    expect(screen.getByRole('status', { name: 'Loading match' })).toBeInTheDocument();

    expect(await screen.findByRole('heading', { name: 'Arsenal vs Chelsea' })).toBeInTheDocument();
    expect(screen.getByText('Premier League')).toBeInTheDocument();
    expect(screen.getByText('2.10')).toBeInTheDocument();
  });

  it('shows a not-found message for an unknown match id', async () => {
    renderAt('does-not-exist');

    expect(await screen.findByText('Match not found.')).toBeInTheDocument();
  });
});
