import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStaffAuthStore } from '../features/auth/staffAuthStore';
import type { BetAndGetCampaign, DepositCampaign, PromoCard } from '../lib/backendApi';
import CmsPromoCardsPage from './CmsPromoCardsPage';

const campaign: BetAndGetCampaign = {
  id: 'campaign-1',
  brandId: 'brand-1',
  name: 'CL Bet & Get',
  description: null,
  enabled: true,
  startAt: null,
  endAt: null,
  rewardType: 'FIXED',
  rewardAmountCents: 1_000,
  rewardPercent: null,
  rewardCapCents: null,
  trigger: 'PLACEMENT',
  triggerOnWon: false,
  triggerOnLost: false,
  triggerOnVoid: false,
  minStakeCents: null,
  minOddsPerLeg: null,
  minCombinedOdds: null,
  betType: 'EITHER',
  bettingTiming: 'EITHER',
  minSelections: null,
  allowMultipleRedemptions: false,
  maxRedemptionsPerPlayer: null,
  audienceMode: 'ALL',
  segments: [],
  createdAt: '2026-07-24T00:00:00Z',
  updatedAt: '2026-07-24T00:00:00Z',
  scopes: [],
};

const depositCampaign: DepositCampaign = {
  id: 'deposit-campaign-1',
  brandId: 'brand-1',
  name: 'First Deposit Bonus',
  description: null,
  enabled: true,
  startAt: null,
  endAt: null,
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
  allowMultipleRedemptions: false,
  maxRedemptionsPerPlayer: null,
  audienceMode: 'ALL',
  segments: [],
  createdAt: '2026-07-24T00:00:00Z',
  updatedAt: '2026-07-24T00:00:00Z',
};

const decorativeCard: PromoCard = {
  id: 'card-1',
  brandId: 'brand-1',
  mimeType: 'image/png',
  title: 'Welcome offer',
  subtitle: null,
  sortOrder: 0,
  autoCreated: false,
  betAndGetCampaignId: null,
  depositCampaignId: null,
  registerCampaignId: null,
  leaderboardCampaignId: null,
  createdAt: '2026-07-24T00:00:00Z',
  updatedAt: '2026-07-24T00:00:00Z',
};

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <CmsPromoCardsPage />
    </QueryClientProvider>,
  );
}

function stubFetch(handler: (url: string, method: string, init?: RequestInit) => Response | Promise<Response> | undefined) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method ?? 'GET';
    const result = await handler(url, method, init);
    if (result) return result;
    if (url === '/backend/admin/bet-and-get-campaigns') {
      return new Response(JSON.stringify([campaign]), { status: 200 });
    }
    if (url === '/backend/admin/deposit-campaigns') {
      return new Response(JSON.stringify([depositCampaign]), { status: 200 });
    }
    if (url === '/backend/admin/homepage-carousel-config') {
      return new Response(JSON.stringify({ enabled: false, autoScrollSeconds: 6 }), { status: 200 });
    }
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  useStaffAuthStore.setState({
    accessToken: 'header.payload.signature',
    user: { sub: 'staff-1', username: 'cms_alice', role: 'CMS' },
    isInitialized: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CmsPromoCardsPage', () => {
  it('loads and saves the homepage auto-scroll settings', async () => {
    const fetchMock = stubFetch((url, method) => {
      if (method === 'GET' && url === '/backend/admin/promo-cards') {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (method === 'GET' && url === '/backend/admin/homepage-carousel-config') {
        return new Response(JSON.stringify({ enabled: false, autoScrollSeconds: 6 }), { status: 200 });
      }
      if (method === 'PUT' && url === '/backend/admin/homepage-carousel-config') {
        return new Response(JSON.stringify({ enabled: true, autoScrollSeconds: 8 }), { status: 200 });
      }
      return undefined;
    });

    renderPage();

    const enabledCheckbox = await screen.findByLabelText('Enabled');
    expect(enabledCheckbox).not.toBeChecked();
    await userEvent.click(enabledCheckbox);
    await userEvent.clear(screen.getByLabelText('Auto-scroll every N seconds'));
    await userEvent.type(screen.getByLabelText('Auto-scroll every N seconds'), '8');
    await userEvent.click(screen.getByRole('button', { name: 'Save auto-scroll settings' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/homepage-carousel-config',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ enabled: true, autoScrollSeconds: 8 }),
      }),
    );
  });

  it('lists cards showing their linked campaign, collapsed by default', async () => {
    stubFetch((url) => {
      if (url === '/backend/admin/promo-cards') {
        return new Response(JSON.stringify([{ ...decorativeCard, betAndGetCampaignId: 'campaign-1' }]), {
          status: 200,
        });
      }
      return undefined;
    });

    renderPage();

    expect(await screen.findByText('Welcome offer')).toBeInTheDocument();
    expect(await screen.findByText('Links to: CL Bet & Get')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('shows "Decorative" for a card with no campaign link', async () => {
    stubFetch((url) => {
      if (url === '/backend/admin/promo-cards') {
        return new Response(JSON.stringify([decorativeCard]), { status: 200 });
      }
      return undefined;
    });

    renderPage();

    expect(await screen.findByText(/Decorative - no campaign link/)).toBeInTheDocument();
  });

  it('shows an empty state with no cards', async () => {
    stubFetch((url) => {
      if (url === '/backend/admin/promo-cards') {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return undefined;
    });

    renderPage();

    expect(await screen.findByText('No promo cards yet - add one above.')).toBeInTheDocument();
  });

  it('uploading a new card posts the file and fields as multipart form data', async () => {
    const fetchMock = stubFetch((url, method, init) => {
      if (method === 'GET' && url === '/backend/admin/promo-cards') {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (method === 'POST' && url === '/backend/admin/promo-cards') {
        expect(init!.body).toBeInstanceOf(FormData);
        const formData = init!.body as FormData;
        expect(formData.get('title')).toBe('Welcome offer');
        expect(formData.get('betAndGetCampaignId')).toBe('campaign-1');
        expect(formData.get('depositCampaignId')).toBeNull();
        expect(formData.get('file')).toBeInstanceOf(File);
        return new Response(JSON.stringify({ ...decorativeCard, betAndGetCampaignId: 'campaign-1' }), {
          status: 200,
        });
      }
      return undefined;
    });

    renderPage();
    await screen.findByText('No campaign (decorative only)');

    const file = new File(['bytes'], 'promo.png', { type: 'image/png' });
    await userEvent.upload(screen.getByLabelText('Image'), file);
    await userEvent.type(screen.getByLabelText('Title (optional)'), 'Welcome offer');
    await userEvent.selectOptions(screen.getByLabelText('Linked campaign'), 'bet-and-get:campaign-1');
    await userEvent.click(screen.getByRole('button', { name: 'Add promo card' }));

    expect(fetchMock).toHaveBeenCalledWith('/backend/admin/promo-cards', expect.objectContaining({ method: 'POST' }));
  });

  it('linking a card to a deposit campaign shows it grouped separately and saves depositCampaignId', async () => {
    const fetchMock = stubFetch((url, method, init) => {
      if (method === 'GET' && url === '/backend/admin/promo-cards') {
        return new Response(JSON.stringify([decorativeCard]), { status: 200 });
      }
      if (method === 'PATCH' && url === '/backend/admin/promo-cards/card-1') {
        expect(JSON.parse(init!.body as string)).toMatchObject({
          betAndGetCampaignId: null,
          depositCampaignId: 'deposit-campaign-1',
        });
        return new Response(JSON.stringify({ ...decorativeCard, depositCampaignId: 'deposit-campaign-1' }), {
          status: 200,
        });
      }
      return undefined;
    });

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /Welcome offer/ }));
    const campaignSelects = screen.getAllByLabelText('Linked campaign');
    const rowSelect = campaignSelects[campaignSelects.length - 1]!;

    expect((await screen.findAllByRole('option', { name: 'First Deposit Bonus' })).length).toBeGreaterThan(0);
    await userEvent.selectOptions(rowSelect, 'deposit:deposit-campaign-1');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/promo-cards/card-1',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('shows a placeholder (not a broken image) and an "add image" prompt for an auto-created card with no artwork yet', async () => {
    stubFetch((url) => {
      if (url === '/backend/admin/promo-cards') {
        return new Response(
          JSON.stringify([{ ...decorativeCard, mimeType: null, autoCreated: true, title: 'Auto card' }]),
          { status: 200 },
        );
      }
      return undefined;
    });

    renderPage();
    expect(await screen.findByText('No image')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Auto card/ }));
    expect(screen.getByText(/Add image \(auto-created, no artwork uploaded yet\)/)).toBeInTheDocument();
  });

  it('uploading an image on a card posts the file to its image endpoint', async () => {
    const fetchMock = stubFetch((url, method, init) => {
      if (method === 'GET' && url === '/backend/admin/promo-cards') {
        return new Response(JSON.stringify([{ ...decorativeCard, mimeType: null, autoCreated: true }]), {
          status: 200,
        });
      }
      if (method === 'POST' && url === '/backend/admin/promo-cards/card-1/image') {
        expect(init!.body).toBeInstanceOf(FormData);
        expect((init!.body as FormData).get('file')).toBeInstanceOf(File);
        return new Response(JSON.stringify({ ...decorativeCard, mimeType: 'image/png' }), { status: 200 });
      }
      return undefined;
    });

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /Welcome offer/ }));

    const file = new File(['bytes'], 'artwork.png', { type: 'image/png' });
    await userEvent.upload(screen.getByLabelText(/Add image/), file);

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/promo-cards/card-1/image',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('removing a card sends a DELETE for its id', async () => {
    const fetchMock = stubFetch((url, method) => {
      if (method === 'GET' && url === '/backend/admin/promo-cards') {
        return new Response(JSON.stringify([decorativeCard]), { status: 200 });
      }
      if (method === 'DELETE' && url === '/backend/admin/promo-cards/card-1') {
        return new Response(null, { status: 204 });
      }
      return undefined;
    });

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /Welcome offer/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/promo-cards/card-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('editing a card sends a PATCH with the updated fields', async () => {
    const fetchMock = stubFetch((url, method, init) => {
      if (method === 'GET' && url === '/backend/admin/promo-cards') {
        return new Response(JSON.stringify([decorativeCard]), { status: 200 });
      }
      if (method === 'PATCH' && url === '/backend/admin/promo-cards/card-1') {
        expect(JSON.parse(init!.body as string)).toMatchObject({ betAndGetCampaignId: 'campaign-1' });
        return new Response(JSON.stringify({ ...decorativeCard, betAndGetCampaignId: 'campaign-1' }), {
          status: 200,
        });
      }
      return undefined;
    });

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /Welcome offer/ }));
    // Two "Linked campaign" selects are on screen at once here - the
    // always-visible New promo card form's, and this expanded row's.
    const campaignSelects = screen.getAllByLabelText('Linked campaign');
    await userEvent.selectOptions(campaignSelects[campaignSelects.length - 1]!, 'bet-and-get:campaign-1');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/backend/admin/promo-cards/card-1',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });
});
