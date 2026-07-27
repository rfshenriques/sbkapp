import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';
import { ANONYMOUS_VIEWER, type AudienceViewer } from '../audience/audience';
import { OptionalPlayerAuthService } from '../auth/optional-player-auth.service';
import { ViewerResolverService } from '../margins/viewer-resolver.service';
import { PromoCardService } from './promo-card.service';
import { PublicPromoCardController } from './public-promo-card.controller';

describe('PublicPromoCardController', () => {
  async function buildController(userId: string | null, viewer: AudienceViewer = ANONYMOUS_VIEWER) {
    const promoCardService = { listForViewer: vi.fn().mockResolvedValue([]) };
    const optionalPlayerAuthService = {
      resolve: vi.fn().mockResolvedValue(userId ? { sub: userId, username: 'p', email: 'p@example.com', brandId: 'b' } : null),
    };
    const viewerResolverService = { resolve: vi.fn().mockResolvedValue(viewer) };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PublicPromoCardController],
      providers: [
        { provide: PromoCardService, useValue: promoCardService },
        { provide: OptionalPlayerAuthService, useValue: optionalPlayerAuthService },
        { provide: ViewerResolverService, useValue: viewerResolverService },
      ],
    }).compile();

    return {
      controller: moduleRef.get(PublicPromoCardController),
      promoCardService,
      optionalPlayerAuthService,
      viewerResolverService,
    };
  }

  it('resolves the viewer from the Authorization header and passes it through to listForViewer', async () => {
    const viewer: AudienceViewer = { isLoggedIn: true, segmentIds: ['seg-1'] };
    const { controller, promoCardService, optionalPlayerAuthService, viewerResolverService } = await buildController(
      'user-1',
      viewer,
    );

    await controller.list('brand-1', 'Bearer some-token');

    expect(optionalPlayerAuthService.resolve).toHaveBeenCalledWith('Bearer some-token');
    expect(viewerResolverService.resolve).toHaveBeenCalledWith('Bearer some-token');
    expect(promoCardService.listForViewer).toHaveBeenCalledWith('brand-1', viewer, 'user-1');
  });

  it('passes null when there is no valid token, same as browsing logged out', async () => {
    const { controller, promoCardService } = await buildController(null);

    await controller.list('brand-1', undefined);

    expect(promoCardService.listForViewer).toHaveBeenCalledWith('brand-1', ANONYMOUS_VIEWER, null);
  });

  it('throws NotFoundException for a missing item', async () => {
    const { controller, promoCardService } = await buildController(null);
    (promoCardService as unknown as { getItemData: ReturnType<typeof vi.fn> }).getItemData = vi
      .fn()
      .mockResolvedValue(null);

    const res = { set: vi.fn() } as never;
    await expect(controller.getItem('brand-1', 'missing', res)).rejects.toBeInstanceOf(NotFoundException);
  });
});
