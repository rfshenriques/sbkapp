import { Controller, Get, NotFoundException, Param, ParseEnumPipe, Res, StreamableFile } from '@nestjs/common';
import { BrandImageSlot } from '@prisma/client';
import type { Response } from 'express';
import { BrandImagesService } from './brand-images.service';

/**
 * Unauthenticated - apps/frontend needs these to render for anonymous
 * players too (the register page's promo panel, the homepage offer card),
 * same reasoning as PublicBrandController. Plain <img src> consumption, so
 * this serves raw bytes with the stored content type rather than JSON.
 */
@Controller('public/brand-images')
export class PublicBrandImagesController {
  constructor(private readonly brandImagesService: BrandImagesService) {}

  @Get(':brandId/:slot')
  async getImage(
    @Param('brandId') brandId: string,
    @Param('slot', new ParseEnumPipe(BrandImageSlot)) slot: BrandImageSlot,
    @Res({ passthrough: true }) res: Response,
  ) {
    const image = await this.brandImagesService.getImageData(brandId, slot);
    if (!image) {
      throw new NotFoundException('Brand image not found');
    }

    res.set({
      'Content-Type': image.mimeType,
      // Player-facing and rarely changed - a short cache still lets a
      // re-upload show up reasonably quickly without hammering the DB.
      'Cache-Control': 'public, max-age=300',
    });
    // Prisma returns Bytes fields as a plain Uint8Array, not a Node Buffer -
    // wrap it so Express can actually stream it as binary.
    return new StreamableFile(Buffer.from(image.data));
  }
}
