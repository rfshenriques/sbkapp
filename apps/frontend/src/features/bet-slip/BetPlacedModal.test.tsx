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
    render(<BetPlacedModal />);

    expect(screen.getByText('🎁 Qualifies for CL Bet & Get - get 10.00 € as a freebet')).toBeInTheDocument();
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
    render(<BetPlacedModal />);

    expect(screen.getByText('🎁 Qualifies for CL Bet & Get - get 10.00 € as a freebet')).toBeInTheDocument();
    expect(screen.getByText('🎁 Qualifies for Welcome Deposit Bonus - get 25.00 € as a freebet')).toBeInTheDocument();
  });

  it('shows no campaign section when the placed bet qualified for none', () => {
    useBetPlacedModalStore.setState({
      summary: { stakeCents: 1000, potentialPayoutCents: 2100, combinedOdds: 2.1, betCount: 1, betAndGetCampaignName: null, betAndGetCampaignRewardCents: null, depositCampaignName: null, depositCampaignRewardCents: null },
    });
    render(<BetPlacedModal />);

    expect(screen.queryByText(/Qualifies for/)).not.toBeInTheDocument();
  });
});
