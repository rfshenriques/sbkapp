import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateBrandDto, UpdateBrandDto } from './dto/create-brand.dto';
import { normalizeDomain } from './normalize-domain';

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
        logoUrl: dto.logoUrl,
        themeMode: dto.themeMode,
        buttonColorHex: dto.buttonColorHex,
        highlightColorHex: dto.highlightColorHex,
        filterColorHex: dto.filterColorHex,
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
          logoUrl: dto.logoUrl,
          themeMode: dto.themeMode,
          buttonColorHex: dto.buttonColorHex,
          highlightColorHex: dto.highlightColorHex,
          filterColorHex: dto.filterColorHex,
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
   * Uploading a logo replaces both the stored bytes and Brand.logoUrl (now
   * pointing at the public serving path below) in one write - a brand that
   * previously had a pasted external URL just gets overwritten, since only
   * one logo can be active at a time.
   */
  async setLogo(brandId: string, fileData: Buffer, mimeType: string) {
    await this.getBrand(brandId);
    // multer's Buffer is typed against ArrayBufferLike (could in theory be a
    // SharedArrayBuffer), which Prisma's Bytes field rejects - re-wrapping
    // guarantees a plain ArrayBuffer-backed Buffer instead.
    const data = Buffer.from(fileData);

    await this.prisma.$transaction([
      this.prisma.brandLogo.upsert({
        where: { brandId },
        create: { brandId, data, mimeType },
        update: { data, mimeType },
      }),
      this.prisma.brand.update({
        where: { id: brandId },
        // Every app (apps/frontend, apps/backoffice, apps/master-backoffice)
        // proxies "/backend/*" to this service with that prefix stripped -
        // see each app's vite.config.ts - so logoUrl must include it too,
        // the same as every other path those apps build for themselves.
        data: { logoUrl: `/backend/public/brands/${brandId}/logo` },
      }),
    ]);

    return this.getBrand(brandId);
  }

  async removeLogo(brandId: string) {
    await this.getBrand(brandId);

    await this.prisma.$transaction([
      this.prisma.brandLogo.deleteMany({ where: { brandId } }),
      this.prisma.brand.update({ where: { id: brandId }, data: { logoUrl: null } }),
    ]);

    return this.getBrand(brandId);
  }

  /** Includes the raw bytes - only for serving the actual image (see PublicBrandController). */
  async getLogoData(brandId: string) {
    return this.prisma.brandLogo.findUnique({ where: { brandId } });
  }
}
