import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BrandLogoSlot, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateBrandDto, UpdateBrandDto } from './dto/create-brand.dto';
import { normalizeDomain } from './normalize-domain';

/** Which Brand column a given logo slot's resolved serving URL is stored on. */
const LOGO_URL_FIELD: Record<BrandLogoSlot, 'logoLightUrl' | 'logoDarkUrl' | 'shareLogoLightUrl' | 'shareLogoDarkUrl'> =
  {
    SITE_LIGHT: 'logoLightUrl',
    SITE_DARK: 'logoDarkUrl',
    SHARE_LIGHT: 'shareLogoLightUrl',
    SHARE_DARK: 'shareLogoDarkUrl',
  };

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  async createBrand(dto: CreateBrandDto) {
    const domain = dto.domain ? normalizeDomain(dto.domain) : undefined;

    const existing = await this.prisma.brand.findFirst({
      where: {
        OR: [{ slug: dto.slug }, ...(domain ? [{ domain }] : [])],
      },
    });
    if (existing) {
      throw new ConflictException('Slug or domain already in use by another brand');
    }

    return this.prisma.brand.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        domain,
        logoLightUrl: dto.logoLightUrl,
        logoDarkUrl: dto.logoDarkUrl,
        shareLogoLightUrl: dto.shareLogoLightUrl,
        shareLogoDarkUrl: dto.shareLogoDarkUrl,
        themeMode: dto.themeMode,
        currencyCode: dto.currencyCode,
        backgroundColor: dto.backgroundColor as Prisma.InputJsonValue | undefined,
        surfaceColor: dto.surfaceColor as Prisma.InputJsonValue | undefined,
        buttonColor: dto.buttonColor as Prisma.InputJsonValue | undefined,
        highlightColor: dto.highlightColor as Prisma.InputJsonValue | undefined,
        filterColor: dto.filterColor as Prisma.InputJsonValue | undefined,
        textColor: dto.textColor as Prisma.InputJsonValue | undefined,
        freebetBadgeColor: dto.freebetBadgeColor as Prisma.InputJsonValue | undefined,
      },
      include: { productFlags: true },
    });
  }

  async listBrands() {
    return this.prisma.brand.findMany({
      include: { productFlags: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getBrand(id: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: { productFlags: true },
    });
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }
    return brand;
  }

  async updateBrand(id: string, dto: UpdateBrandDto) {
    await this.getBrand(id);

    return this.prisma.brand
      .update({
        where: { id },
        data: {
          name: dto.name,
          domain: dto.domain ? normalizeDomain(dto.domain) : dto.domain,
          logoLightUrl: dto.logoLightUrl,
          logoDarkUrl: dto.logoDarkUrl,
          shareLogoLightUrl: dto.shareLogoLightUrl,
          shareLogoDarkUrl: dto.shareLogoDarkUrl,
          themeMode: dto.themeMode,
          currencyCode: dto.currencyCode,
          backgroundColor: dto.backgroundColor as Prisma.InputJsonValue | undefined,
          surfaceColor: dto.surfaceColor as Prisma.InputJsonValue | undefined,
          buttonColor: dto.buttonColor as Prisma.InputJsonValue | undefined,
          highlightColor: dto.highlightColor as Prisma.InputJsonValue | undefined,
          filterColor: dto.filterColor as Prisma.InputJsonValue | undefined,
          textColor: dto.textColor as Prisma.InputJsonValue | undefined,
          freebetBadgeColor: dto.freebetBadgeColor as Prisma.InputJsonValue | undefined,
          freebetStakeReturnedOnWin: dto.freebetStakeReturnedOnWin,
        },
        include: { productFlags: true },
      })
      .catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException('Domain already in use by another brand');
        }
        throw error;
      });
  }

  async setProductFlag(brandId: string, product: string, enabled: boolean) {
    await this.getBrand(brandId);

    await this.prisma.brandProductFlag.upsert({
      where: { brandId_product: { brandId, product } },
      create: { brandId, product, enabled },
      update: { enabled },
    });

    return this.getBrand(brandId);
  }

  /**
   * Uploading a logo replaces both the stored bytes for that slot and the
   * matching Brand.*Url column (now pointing at the public serving path
   * below) in one write - each of the 4 slots (site/share x light/dark) is
   * independent, so uploading one never touches the others.
   */
  async setLogo(brandId: string, slot: BrandLogoSlot, fileData: Buffer, mimeType: string) {
    await this.getBrand(brandId);
    // multer's Buffer is typed against ArrayBufferLike (could in theory be a
    // SharedArrayBuffer), which Prisma's Bytes field rejects - re-wrapping
    // guarantees a plain ArrayBuffer-backed Buffer instead.
    const data = Buffer.from(fileData);

    await this.prisma.$transaction([
      this.prisma.brandLogo.upsert({
        where: { brandId_slot: { brandId, slot } },
        create: { brandId, slot, data, mimeType },
        update: { data, mimeType },
      }),
      this.prisma.brand.update({
        where: { id: brandId },
        // Every app (apps/frontend, apps/backoffice, apps/master-backoffice)
        // proxies "/backend/*" to this service with that prefix stripped -
        // see each app's vite.config.ts - so the stored URL must include it
        // too, the same as every other path those apps build for themselves.
        data: { [LOGO_URL_FIELD[slot]]: `/backend/public/brands/${brandId}/logo/${slot}` },
      }),
    ]);

    return this.getBrand(brandId);
  }

  async removeLogo(brandId: string, slot: BrandLogoSlot) {
    await this.getBrand(brandId);

    await this.prisma.$transaction([
      this.prisma.brandLogo.deleteMany({ where: { brandId, slot } }),
      this.prisma.brand.update({ where: { id: brandId }, data: { [LOGO_URL_FIELD[slot]]: null } }),
    ]);

    return this.getBrand(brandId);
  }

  /** Includes the raw bytes - only for serving the actual image (see PublicBrandController). */
  async getLogoData(brandId: string, slot: BrandLogoSlot) {
    return this.prisma.brandLogo.findUnique({ where: { brandId_slot: { brandId, slot } } });
  }
}
