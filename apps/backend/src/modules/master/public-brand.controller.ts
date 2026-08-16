import { Controller, Get, NotFoundException, Param, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeDomain } from './normalize-domain';

/** Only what's safe to expose publicly - no product flags, no internal metadata beyond the brand's own. */
const PUBLIC_BRAND_SELECT = {
  id: true,
  name: true,
  logoUrl: true,
  themeMode: true,
  buttonColorHex: true,
  highlightColorHex: true,
  filterColorHex: true,
  supportHelplineText: true,
} as const;

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

  /**
   * Resolves this deployment's brand from the hostname the request actually
   * arrived on - the mechanism for "one running apps/frontend serving many
   * brands' domains" (see docs/PROJECT_BRIEF.md Section 10). Must be
   * declared before GET :id below: distinct path shape (two segments vs
   * one) so there's no real routing ambiguity, but this keeps the more
   * specific route first by convention.
   */
  @Get('by-domain/:domain')
  async getBrandByDomain(@Param('domain') domain: string) {
    const normalized = normalizeDomain(domain);
    const brand = await this.prisma.brand.findUnique({
      where: { domain: normalized },
      select: PUBLIC_BRAND_SELECT,
    });
    if (!brand) {
      throw new NotFoundException('No brand configured for this domain');
    }
    return brand;
  }

  @Get(':id')
  async getBrand(@Param('id') id: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      select: PUBLIC_BRAND_SELECT,
    });
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }
    return brand;
  }

  /**
   * Raw bytes of a staff-uploaded logo (see BrandsService.setLogo), for
   * plain <img src> consumption - what Brand.logoUrl points at once a
   * brand has one. Unauthenticated for the same reason as the rest of this
   * controller: the logo has to render before a player ever signs in.
   */
  @Get(':id/logo')
  async getLogo(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const logo = await this.prisma.brandLogo.findUnique({ where: { brandId: id } });
    if (!logo) {
      throw new NotFoundException('Brand has no uploaded logo');
    }

    res.set({
      'Content-Type': logo.mimeType,
      'Cache-Control': 'public, max-age=300',
    });
    // Prisma returns Bytes fields as a plain Uint8Array, not a Node Buffer -
    // wrap it so Express can actually stream it as binary.
    return new StreamableFile(Buffer.from(logo.data));
  }
}
