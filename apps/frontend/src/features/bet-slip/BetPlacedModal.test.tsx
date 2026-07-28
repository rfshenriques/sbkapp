import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BetPlacedModal } from './BetPlacedModal';
import { useBetPlacedModalStore } from './betPlacedModalStore';

beforeEach(() => {
  useBetPlacedModalStore.setState({ summary: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('BetPlacedModal', () => {
  it('renders nothing when there is no summary', () => {
    render(<BetPlacedModal />);

    expect(screen.queryByText('Bet placed')).not.toBeInTheDocument();
  });

  it('shows the potential payout, stake, and combined odds for a single accumulator', () => {
    useBetPlacedModalStore.setState({
      summary: { stakeCents: 1000, potentialPayoutCents: 5250, combinedOdds: 5.25, betCount: 1, betAndGetCampaignName: null, betAndGetCampaignRewardCents: null, depositCampaignName: null, depositCampaignRewardCents: null },
    });
    render(<BetPlacedModal />);

    expect(screen.getByText('Bet placed')).toBeInTheDocument();
    expect(screen.getByText('52.50 €')).toBeInTheDocument();
    expect(screen.getByText('10.00 €')).toBeInTheDocument();
    expect(screen.getByText('Odds')).toBeInTheDocument();
    expect(screen.getByText('5.25')).toBeInTheDocument();
    expect(screen.queryByText('Bets placed')).not.toBeInTheDocument();
  });

  it('shows a bet count instead of odds when several singles were placed at once', () => {
    useBetPlacedModalStore.setState({
      summary: { stakeCents: 2000, potentialPayoutCents: 4200, combinedOdds: null, betCount: 2, betAndGetCampaignName: null, betAndGetCampaignRewardCents: null, depositCampaignName: null, depositCampaignRewardCents: null },
    });
    render(<BetPlacedModal />);

    expect(screen.getByText('Bets placed')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.queryByText('Odds')).not.toBeInTheDocument();
  });

  it('closes when the close button is clicked', async () => {
    useBetPlacedModalStore.setState({
      summary: { stakeCents: 1000, potentialPayoutCents: 2100, combinedOdds: 2.1, betCount: 1, betAndGetCampaignName: null, betAndGetCampaignRewardCents: null, depositCampaignName: null, depositCampaignRewardCents: null },
    });
    render(<BetPlacedModal />);

    const [, closeButton] = screen.getAllByRole('button', { name: 'Close bet placed confirmation' });
    await userEvent.click(closeButton!);

    expect(useBetPlacedModalStore.getState().summary).toBeNull();
  });

  it('closes when Bet again is clicked', async () => {
    useBetPlacedModalStore.setState({
      summary: { stakeCents: 1000, potentialPayoutCents: 2100, combinedOdds: 2.1, betCount: 1, betAndGetCampaignName: null, betAndGetCampaignRewardCents: null, depositCampaignName: null, depositCampaignRewardCents: null },
    });
    render(<BetPlacedModal />);

    await userEvent.click(screen.getByRole('button', { name: 'Bet again' }));

    expect(useBetPlacedModalStore.getState().summary).toBeNull();
  });

  it('shares via the Web Share API when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, share });
    useBetPlacedModalStore.setState({
      summary: { stakeCents: 1000, potentialPayoutCents: 5250, combinedOdds: 5.25, betCount: 1, betAndGetCampaignName: null, betAndGetCampaignRewardCents: null, depositCampaignName: null, depositCampaignRewardCents: null },
    });
    render(<BetPlacedModal />);

    await userEvent.click(screen.getByRole('button', { name: /Share/ }));

    expect(share).toHaveBeenCalledWith({
      text: 'I just placed a bet! Stake 10.00 € at odds 5.25 - potential payout 52.50 €.',
    });
  });

  it('falls back to clipboard and shows feedback when the Web Share API is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, share: undefined, clipboard: { writeText } });
    useBetPlacedModalStore.setState({
      summary: { stakeCents: 2000, potentialPayoutCents: 4200, combinedOdds: null, betCount: 2, betAndGetCampaignName: null, betAndGetCampaignRewardCents: null, depositCampaignName: null, depositCampaignRewardCents: null },
    });
    render(<BetPlacedModal />);

    await userEvent.click(screen.getByRole('button', { name: /Share/ }));

    expect(writeText).toHaveBeenCalledWith(
      'I just placed 2 bets! Total stake 20.00 € - total potential payout 42.00 €.',
    );
    expect(await screen.findByText('Copied to clipboard')).toBeInTheDocument();
  });

  it('shows the campaign name and reward once the placed bet qualified for one', () => {
    useBetPlacedModalStore.setState({
      summary: {
        stakeCents: 1000,
        potentialPayoutCents: 2100,
        combinedOdds: 2.1,
        betCount: 1,
        betAndGetCampaignName: 'CL Bet & Get',
        betAndGetCampaignRewardCents: 1000,
        depositCampaignName: null,
        depositCampaignRewardCents: null,
      },
    });
    const { container } = render(<BetPlacedModal />);

    expect(container.querySelector('p.text-highlight')).toHaveTextContent('🎁 Qualifies for CL Bet & Get to get');
    expect(container.querySelector('p.text-highlight')).toHaveTextContent('10.00 € in Freebets');
  });

  it('shows both a Bet & Get and a deposit campaign qualification at once', () => {
    useBetPlacedModalStore.setState({
      summary: {
        stakeCents: 1000,
        potentialPayoutCents: 2100,
        combinedOdds: 2.1,
        betCount: 1,
        betAndGetCampaignName: 'CL Bet & Get',
        betAndGetCampaignRewardCents: 1000,
        depositCampaignName: 'Welcome Deposit Bonus',
        depositCampaignRewardCents: 2500,
      },
    });
    const { container } = render(<BetPlacedModal />);

    const notes = container.querySelectorAll('p.text-highlight');
    expect(notes).toHaveLength(2);
    expect(notes[0]).toHaveTextContent('🎁 Qualifies for CL Bet & Get to get');
    expect(notes[0]).toHaveTextContent('10.00 € in Freebets');
    expect(notes[1]).toHaveTextContent('🎁 Qualifies for Welcome Deposit Bonus to get');
    expect(notes[1]).toHaveTextContent('25.00 € in Freebets');
  });

  it('shows no campaign section when the placed bet qualified for none', () => {
    useBetPlacedModalStore.setState({
      summary: { stakeCents: 1000, potentialPayoutCents: 2100, combinedOdds: 2.1, betCount: 1, betAndGetCampaignName: null, betAndGetCampaignRewardCents: null, depositCampaignName: null, depositCampaignRewardCents: null },
    });
    render(<BetPlacedModal />);

    expect(screen.queryByText(/Qualifies for/)).not.toBeInTheDocument();
  });

  describe('single-bet placement (bet details, share/copy)', () => {
    const bet = {
      id: 'bet-1',
      stakeCents: 1000,
      combinedOdds: '2.10',
      potentialPayoutCents: 2100,
      status: 'PENDING' as const,
      settledPayoutCents: null,
      settledAt: null,
      createdAt: '2026-07-17T00:00:00Z',
      selections: [
        {
          id: 'sel-1',
          matchId: 'match-1',
          marketId: 'match-result',
          selectionId: 'home',
          matchLabel: 'Arsenal vs Chelsea',
          marketName: 'Match Result',
          selectionName: 'Home',
          odds: '2.10',
          status: 'OPEN' as const,
        },
      ],
      fundedByFreebets: false,
      insuranceCostPercent: 0,
      accaBoostPercent: 0,
      betAndGetCampaignName: null,
      betAndGetCampaignRewardCents: null,
      depositCampaignName: null,
      depositCampaignRewardCents: null,
      accaRollbackRewardCents: null,
    };

    it('shows a collapsed Bet details section that expands to the selection', async () => {
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
          bet,
        },
      });
      render(<BetPlacedModal />);

      const toggle = screen.getByRole('button', { name: 'Bet details' });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');

      await userEvent.click(toggle);

      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Arsenal')).toBeInTheDocument();
      expect(screen.getByText('Chelsea')).toBeInTheDocument();
    });

    it('shows Share and Copy actions instead of the plain-text share button', () => {
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
          bet,
        },
      });
      render(<BetPlacedModal />);

      expect(screen.getByRole('button', { name: /Share/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Copy/ })).toBeInTheDocument();
    });

    it('copies the shared-bet link to the clipboard when Copy is clicked', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
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
          bet,
        },
      });
      render(<BetPlacedModal />);

      await userEvent.click(screen.getByRole('button', { name: /Copy/ }));

      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/shared-bet?sel='));
      expect(await screen.findByText('Link copied to clipboard')).toBeInTheDocument();
    });

    it('does not show a Bet details section for a multi-singles placement with no single bet', () => {
      useBetPlacedModalStore.setState({
        summary: {
          stakeCents: 2000,
          potentialPayoutCents: 4200,
          combinedOdds: null,
          betCount: 2,
          betAndGetCampaignName: null,
          betAndGetCampaignRewardCents: null,
          depositCampaignName: null,
          depositCampaignRewardCents: null,
        },
      });
      render(<BetPlacedModal />);

      expect(screen.queryByRole('button', { name: 'Bet details' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Copy/ })).not.toBeInTheDocument();
    });
  });
});
