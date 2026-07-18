import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Unauthenticated - apps/frontend (player-facing, no login required to
 * browse) needs a brand's theme/logo before a player ever signs in, so
 * this can't sit behind player, staff, or master auth. Deliberately
 * returns only what's safe to expose publicly (no domain, no product
 * flags, no internal ids beyond the brand's own).
 */
@Controller('public/brands')
export class PublicBrandController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':id')
  async getBrand(@Param('id') id: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        themeMode: true,
        buttonColorHex: true,
        highlightColorHex: true,
      },
    });
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }
    return brand;
  }
}
