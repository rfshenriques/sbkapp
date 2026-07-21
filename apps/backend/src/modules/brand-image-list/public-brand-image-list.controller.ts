import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseEnumPipe,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { BrandImageListKind } from '@prisma/client';
import type { Response } from 'express';
import { BrandImageListService } from './brand-image-list.service';

/**
 * Unauthenticated - apps/frontend's footer needs these to render for
 * anonymous players too, same reasoning as PublicBrandImagesController.
 * Metadata and bytes are split across two routes (like BrandImage) so the
 * footer can list+order items without downloading every image up front.
 */
@Controller('public/brand-image-list')
export class PublicBrandImageListController {
  constructor(private readonly brandImageListService: BrandImageListService) {}

  @Get(':brandId/:kind')
  list(
    @Param('brandId') brandId: string,
    @Param('kind', new ParseEnumPipe(BrandImageListKind)) kind: BrandImageListKind,
  ) {
    return this.brandImageListService.list(brandId, kind);
  }

  @Get(':brandId/item/:id')
  async getItem(
    @Param('brandId') brandId: string,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const item = await this.brandImageListService.getItemData(brandId, id);
    if (!item) {
      throw new NotFoundException('Image not found');
    }

    res.set({
      'Content-Type': item.mimeType,
      'Cache-Control': 'public, max-age=300',
    });
    return new StreamableFile(Buffer.from(item.data));
  }
}
