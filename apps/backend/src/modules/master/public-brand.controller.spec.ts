import { randomUUID } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { PublicBrandController } from './public-brand.controller';

describe('PublicBrandController', () => {
  let moduleRef: TestingModule;
  let controller: PublicBrandController;
  let prisma: PrismaService;
  const createdBrandIds: string[] = [];

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      controllers: [PublicBrandController],
      providers: [PrismaService],
    }).compile();
    await moduleRef.init();

    controller = moduleRef.get(PublicBrandController);
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    if (createdBrandIds.length > 0) {
      await prisma.brand.deleteMany({ where: { id: { in: createdBrandIds } } });
      createdBrandIds.length = 0;
    }
    await moduleRef.close();
  });

  it('returns only the public-safe fields for an existing brand', async () => {
    const unique = randomUUID().slice(0, 8);
    const brand = await prisma.brand.create({
      data: {
        name: `Public Brand ${unique}`,
        slug: `public-brand-${unique}`,
        domain: `${unique}.example.com`,
        themeMode: 'LIGHT',
        buttonColorHex: '#112233',
        highlightColorHex: '#445566',
      },
    });
    createdBrandIds.push(brand.id);

    const result = await controller.getBrand(brand.id);

    expect(result).toEqual({
      id: brand.id,
      name: brand.name,
      logoUrl: null,
      themeMode: 'LIGHT',
      buttonColorHex: '#112233',
      highlightColorHex: '#445566',
      filterColorHex: null,
    });
    expect(result).not.toHaveProperty('domain');
    expect(result).not.toHaveProperty('slug');
  });

  it('404s for an unknown brand id', async () => {
    await expect(controller.getBrand(randomUUID())).rejects.toBeInstanceOf(NotFoundException);
  });

  it('resolves a brand by its exact stored domain', async () => {
    const unique = randomUUID().slice(0, 8);
    const brand = await prisma.brand.create({
      data: {
        name: `Domain Brand ${unique}`,
        slug: `domain-brand-${unique}`,
        domain: `${unique}.example.com`,
      },
    });
    createdBrandIds.push(brand.id);

    const result = await controller.getBrandByDomain(`${unique}.example.com`);

    expect(result.id).toBe(brand.id);
  });

  it('resolves by domain case-insensitively and ignoring a www. prefix', async () => {
    const unique = randomUUID().slice(0, 8);
    const brand = await prisma.brand.create({
      data: {
        name: `Domain Brand ${unique}`,
        slug: `domain-brand-www-${unique}`,
        domain: `${unique}.example.com`,
      },
    });
    createdBrandIds.push(brand.id);

    const result = await controller.getBrandByDomain(`WWW.${unique}.EXAMPLE.COM`);

    expect(result.id).toBe(brand.id);
  });

  it('404s for a domain with no configured brand', async () => {
    await expect(
      controller.getBrandByDomain(`${randomUUID().slice(0, 8)}.example.com`),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
