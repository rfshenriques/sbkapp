import { Controller, Get, Headers, NotFoundException, Param, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { OptionalPlayerAuthService } from '../auth/optional-player-auth.service';
import { ViewerResolverService } from '../margins/viewer-resolver.service';
import { PromoCardService } from './promo-card.service';

/**
 * Unauthenticated, player-facing - backs the homepage and Challenges page.
 * Metadata and bytes are split across two routes (like BrandImageListItem)
 * so the page can list+order cards without downloading every image up
 * front. Login is never required to browse, but a logged-in viewer's own
 * redemption history and segment membership both filter what's visible
 * (see PromoCardService.listForViewer).
 */
@Controller('public/promo-cards')
export class PublicPromoCardController {
  constructor(
    private readonly promoCardService: PromoCardService,
    private readonly optionalPlayerAuthService: OptionalPlayerAuthService,
    private readonly viewerResolverService: ViewerResolverService,
  ) {}

  @Get(':brandId')
  async list(@Param('brandId') brandId: string, @Headers('authorization') authorization?: string) {
    const [viewer, payload] = await Promise.all([
      this.viewerResolverService.resolve(authorization),
      this.optionalPlayerAuthService.resolve(authorization),
    ]);
    return this.promoCardService.listForViewer(brandId, viewer, payload?.sub ?? null);
  }

  @Get(':brandId/item/:id')
  async getItem(
    @Param('brandId') brandId: string,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const card = await this.promoCardService.getItemData(brandId, id);
    if (!card || !card.data || !card.mimeType) {
      throw new NotFoundException('Promo card not found');
    }

    res.set({
      'Content-Type': card.mimeType,
      'Cache-Control': 'public, max-age=300',
    });
    return new StreamableFile(Buffer.from(card.data));
  }
}
