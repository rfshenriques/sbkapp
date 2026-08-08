import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PromoCardItem } from '../../lib/backendApi';
import { useDepositCampaignModalStore } from '../deposit-campaigns/depositCampaignModalStore';
import { PromoCardTile } from './PromoCardTile';

const decorativeCard: PromoCardItem = {
  id: 'card-1',
  mimeType: 'image/png',
  title: 'Welcome offer',
  subtitle: null,
  sortOrder: 0,
  betAndGetCampaignId: null,
  depositCampaignId: null,
  registerCampaignId: null,
  leaderboardCampaignId: null,
  hasImage: true,
  status: 'ACTIVE',
};

function stubFetch(handler: (url: string) => Response | undefined) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    const result = handler(url);
    if (result) return result;
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  useDepositCampaignModalStore.setState({ campaign: null });
  vi.unstubAllGlobals();
});

describe('PromoCardTile', () => {
  it('renders as a plain non-interactive tile when neither campaign id is set', () => {
    render(<PromoCardTile card={decorativeCard} brandId="brand-1" />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('links to the campaign-matches page for a Bet & Get-linked card', () => {
    render(
      <MemoryRouter>
        <PromoCardTile card={{ ...decorativeCard, betAndGetCampaignId: 'campaign-1' }} brandId="brand-1" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link')).toHaveAttribute('href', '/campaigns/campaign-1');
  });

  it('renders a no-image card as a brand-color banner, no <img>', () => {
    render(
      <MemoryRouter>
        <PromoCardTile
          card={{ ...decorativeCard, hasImage: false, mimeType: null, betAndGetCampaignId: 'campaign-1' }}
          brandId="brand-1"
        />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Welcome offer')).toBeInTheDocument();
  });

  it('links to the leaderboard detail page for a leaderboard-linked card', () => {
    render(
      <MemoryRouter>
        <PromoCardTile card={{ ...decorativeCard, leaderboardCampaignId: 'leaderboard-1' }} brandId="brand-1" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link')).toHaveAttribute('href', '/leaderboards/leaderboard-1');
  });

  it('fetches and opens the deposit campaign modal for a deposit-linked card', async () => {
    stubFetch((url) => {
      if (url === '/backend/public/deposit-campaigns/brand-1/deposit-campaign-1') {
        return new Response(
          JSON.stringify({
            id: 'deposit-campaign-1',
            name: 'First Deposit Bonus',
            description: null,
            minDepositAmountCents: 1_000,
            rewardType: 'FIXED',
            fixedRewardAmountCents: 500,
            rewardPercent: null,
            rewardCapCents: null,
            requiresBet: false,
            trigger: 'PLACEMENT',
            triggerOnWon: false,
            triggerOnLost: false,
            triggerOnVoid: false,
            minStakeCents: null,
            minOddsPerLeg: null,
            betType: 'EITHER',
            minSelections: null,
          }),
          { status: 200 },
        );
      }
      return undefined;
    });

    render(<PromoCardTile card={{ ...decorativeCard, depositCampaignId: 'deposit-campaign-1' }} brandId="brand-1" />);

    await userEvent.click(screen.getByRole('button'));

    await vi.waitFor(() =>
      expect(useDepositCampaignModalStore.getState().campaign?.id).toBe('deposit-campaign-1'),
    );
  });
});
