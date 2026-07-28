import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { BetAndGetCampaign } from '../../lib/backendApi';
import { CampaignContextBanner } from './CampaignContextBanner';

const baseCampaign: BetAndGetCampaign = {
  id: 'campaign-1',
  name: 'CL Bet & Get',
  description: 'Bet on Champions League matches to get a free bet.',
  rewardAmountCents: 1_000,
  trigger: 'PLACEMENT',
  triggerOnWon: false,
  triggerOnLost: false,
  triggerOnVoid: false,
  minStakeCents: null,
  minOddsPerLeg: null,
  minCombinedOdds: null,
  betType: 'EITHER',
  minSelections: null,
  bettingTiming: 'EITHER',
};

describe('CampaignContextBanner', () => {
  it('shows the campaign name, description, and requirements with no blocked message', () => {
    render(<CampaignContextBanner campaign={{ ...baseCampaign, bettingTiming: 'PREMATCH_ONLY' }} />);

    expect(screen.getByText('CL Bet & Get')).toBeInTheDocument();
    expect(screen.getByText('Bet on Champions League matches to get a free bet.')).toBeInTheDocument();
    expect(screen.getByText('Prematch bets only')).toBeInTheDocument();
    expect(screen.queryByText(/no longer qualifies|doesn.t qualify yet/)).not.toBeInTheDocument();
  });

  it('shows a blocked message when the match is in scope but fails a prematch-only requirement', () => {
    render(
      <CampaignContextBanner
        campaign={{ ...baseCampaign, bettingTiming: 'PREMATCH_ONLY', timingBlocked: true }}
      />,
    );

    expect(screen.getByText(/only prematch bets count toward this offer/)).toBeInTheDocument();
  });

  it('shows a blocked message when the match is in scope but fails an in-play-only requirement', () => {
    render(
      <CampaignContextBanner campaign={{ ...baseCampaign, bettingTiming: 'INPLAY_ONLY', timingBlocked: true }} />,
    );

    expect(screen.getByText(/only in-play bets count toward this offer/)).toBeInTheDocument();
  });
});
