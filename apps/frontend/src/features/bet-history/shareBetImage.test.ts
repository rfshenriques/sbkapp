import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlacedBet } from '../../lib/backendApi';
import { useBrandStore } from '../brand/brandStore';
import { renderBetCardImage, shareBetImage } from './shareBetImage';

function buildBet(overrides: Partial<PlacedBet> = {}): PlacedBet {
  return {
    id: 'bet-1234567890',
    stakeCents: 1000,
    combinedOdds: '2.00',
    potentialPayoutCents: 2000,
    status: 'WON',
    settledPayoutCents: 2000,
    settledAt: '2026-07-19T12:00:00Z',
    createdAt: '2026-07-19T10:00:00Z',
    fundedByFreebets: false,
    insuranceCostPercent: 0,
    accaBoostPercent: 0,
    betAndGetCampaignName: null,
    betAndGetCampaignRewardCents: null,
    depositCampaignName: null,
    depositCampaignRewardCents: null,
    registerCampaignName: null,
    registerCampaignRewardCents: null,
    accaRollbackRewardCents: null,
    cashedOutValueCents: null,
    cashedOutAt: null,
    selections: [
      {
        id: 'sel-1',
        matchId: 'match-1',
        marketId: 'match-result',
        selectionId: 'home',
        matchLabel: 'Arsenal vs Chelsea',
        marketName: 'Match Result',
        selectionName: 'Home',
        odds: '2.00',
        status: 'WON',
      },
    ],
    ...overrides,
  };
}

/**
 * jsdom has no real canvas backend (the `canvas` npm package is a heavy
 * native binding, not worth adding as a dependency just for this) - every
 * canvas method used by renderBetCardImage is stubbed as a no-op so the
 * drawing code runs without throwing, letting these tests exercise the
 * actual share/download/fallback orchestration around it instead of the
 * pixel output.
 */
function stubCanvas() {
  const context = {
    scale: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arcTo: vi.fn(),
    arc: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    drawImage: vi.fn(),
    measureText: vi.fn(() => ({ width: 40 })),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    callback: BlobCallback,
  ) {
    callback(new Blob(['fake-png'], { type: 'image/png' }));
  });
}

beforeEach(() => {
  stubCanvas();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  useBrandStore.setState({ logoUrl: null, shareLogoUrl: null });
});

/** jsdom never actually loads image sources - firing onload itself is the only way loadImage's promise resolves. */
class FakeImage {
  width = 200;
  height = 50;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

describe('renderBetCardImage', () => {
  it('resolves a PNG blob for a single bet', async () => {
    const blob = await renderBetCardImage(buildBet());
    expect(blob.type).toBe('image/png');
  });

  it('draws the brand share logo onto the card when one is configured for the active theme', async () => {
    vi.stubGlobal('Image', FakeImage);
    useBrandStore.setState({ shareLogoUrl: '/backend/public/brands/brand-1/logo/SHARE_LIGHT' });
    const context = HTMLCanvasElement.prototype.getContext(
      '2d',
    ) as unknown as { drawImage: ReturnType<typeof vi.fn> };

    await renderBetCardImage(buildBet());

    expect(context.drawImage).toHaveBeenCalled();
  });

  it('skips the logo band entirely when no share logo is configured', async () => {
    const context = HTMLCanvasElement.prototype.getContext(
      '2d',
    ) as unknown as { drawImage: ReturnType<typeof vi.fn> };

    await renderBetCardImage(buildBet());

    expect(context.drawImage).not.toHaveBeenCalled();
  });

  it('resolves a PNG blob for a multi-leg accumulator', async () => {
    const bet = buildBet({
      combinedOdds: '4.00',
      selections: [
        ...buildBet().selections,
        {
          id: 'sel-2',
          matchId: 'match-2',
          marketId: 'match-result',
          selectionId: 'away',
          matchLabel: 'Real Madrid vs Barcelona',
          marketName: 'Match Result',
          selectionName: 'Away',
          odds: '2.00',
          status: 'WON',
        },
      ],
    });
    const blob = await renderBetCardImage(bet);
    expect(blob.type).toBe('image/png');
  });
});

describe('shareBetImage', () => {
  it('shares the image via the Web Share API when file sharing is supported', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', { ...navigator, share, canShare });

    const result = await shareBetImage(buildBet(), 'My bet won!');

    expect(result).toBe('shared');
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'My bet won!', files: expect.any(Array) }),
    );
  });

  it('downloads the image when the browser cannot share files', async () => {
    vi.stubGlobal('navigator', { ...navigator, share: undefined, canShare: undefined });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const result = await shareBetImage(buildBet(), 'My bet won!');

    expect(result).toBe('downloaded');
    expect(clickSpy).toHaveBeenCalled();
  });
});
