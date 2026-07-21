import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
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
}
