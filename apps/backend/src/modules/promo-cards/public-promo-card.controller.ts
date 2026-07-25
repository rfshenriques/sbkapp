import { Controller, Get, NotFoundException, Param, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { PromoCardService } from './promo-card.service';

/**
 * Unauthenticated, player-facing - backs the homepage and Promotions page.
 * Metadata and bytes are split across two routes (like BrandImageListItem)
 * so the page can list+order cards without downloading every image up
 * front.
 */
@Controller('public/promo-cards')
export class PublicPromoCardController {
  constructor(private readonly promoCardService: PromoCardService) {}

  @Get(':brandId')
  list(@Param('brandId') brandId: string) {
    return this.promoCardService.list(brandId);
  }

  @Get(':brandId/item/:id')
  async getItem(
    @Param('brandId') brandId: string,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const card = await this.promoCardService.getItemData(brandId, id);
    if (!card) {
      throw new NotFoundException('Promo card not found');
    }

    res.set({
      'Content-Type': card.mimeType,
      'Cache-Control': 'public, max-age=300',
    });
    return new StreamableFile(Buffer.from(card.data));
  }
}
