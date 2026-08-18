import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CampaignRewardAlert } from './CampaignRewardAlert';

describe('CampaignRewardAlert', () => {
  it('says "Qualifies for" (present tense) by default, for a still-pending bet', () => {
    render(<CampaignRewardAlert name="Welcome Boost" rewardCents={500} />);
    expect(screen.getByText('🎁 Qualifies for Welcome Boost')).toBeInTheDocument();
  });

  it('says "Qualified for" (past tense) once the bet has settled', () => {
    render(<CampaignRewardAlert name="Welcome Boost" rewardCents={500} qualified />);
    expect(screen.getByText('🎁 Qualified for Welcome Boost')).toBeInTheDocument();
  });
});
