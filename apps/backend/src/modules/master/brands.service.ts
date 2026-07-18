import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateBrandDto, UpdateBrandDto } from './dto/create-brand.dto';

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  async createBrand(dto: CreateBrandDto) {
    const existing = await this.prisma.brand.findFirst({
      where: {
        OR: [{ slug: dto.slug }, ...(dto.domain ? [{ domain: dto.domain }] : [])],
      },
    });
    if (existing) {
      throw new ConflictException('Slug or domain already in use by another brand');
    }

    return this.prisma.brand.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        domain: dto.domain,
        logoUrl: dto.logoUrl,
        themeMode: dto.themeMode,
        buttonColorHex: dto.buttonColorHex,
        highlightColorHex: dto.highlightColorHex,
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
          domain: dto.domain,
          logoUrl: dto.logoUrl,
          themeMode: dto.themeMode,
          buttonColorHex: dto.buttonColorHex,
          highlightColorHex: dto.highlightColorHex,
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
}
