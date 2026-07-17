import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { useBetSlipStore } from '../features/bet-slip/betSlipStore';
import { AppShell } from './AppShell';

function renderShell() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<div>Page content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useBetSlipStore.setState({ selections: [] });
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
