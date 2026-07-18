import { randomUUID } from 'node:crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { BrandsService } from './brands.service';
import type { CreateBrandDto } from './dto/create-brand.dto';

function buildCreateBrandDto(overrides: Partial<CreateBrandDto> = {}): CreateBrandDto {
  const unique = randomUUID().slice(0, 8);
  return {
    name: `Test Brand ${unique}`,
    slug: `test-brand-${unique}`,
    ...overrides,
  };
}

describe('BrandsService', () => {
  let moduleRef: TestingModule;
  let brandsService: BrandsService;
  let prisma: PrismaService;
  const createdBrandIds: string[] = [];

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [BrandsService, PrismaService],
    }).compile();
    await moduleRef.init();

    brandsService = moduleRef.get(BrandsService);
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    if (createdBrandIds.length > 0) {
      await prisma.brand.deleteMany({ where: { id: { in: createdBrandIds } } });
      createdBrandIds.length = 0;
    }
    await moduleRef.close();
  });

  it('creates a brand with the given theme fields', async () => {
    const dto = buildCreateBrandDto({
      domain: `${randomUUID().slice(0, 8)}.example.com`,
      logoUrl: 'https://example.com/logo.png',
      themeMode: 'LIGHT',
      buttonColorHex: '#112233',
      highlightColorHex: '#445566',
    });

    const brand = await brandsService.createBrand(dto);
    createdBrandIds.push(brand.id);

    expect(brand.name).toBe(dto.name);
    expect(brand.slug).toBe(dto.slug);
    expect(brand.domain).toBe(dto.domain);
    expect(brand.themeMode).toBe('LIGHT');
    expect(brand.buttonColorHex).toBe('#112233');
    expect(brand.productFlags).toEqual([]);
  });

  it('defaults a new brand to dark appearance when themeMode is not given', async () => {
    const brand = await brandsService.createBrand(buildCreateBrandDto());
    createdBrandIds.push(brand.id);

    expect(brand.themeMode).toBe('DARK');
  });

  it('rejects creating a brand with an already-used slug', async () => {
    const dto = buildCreateBrandDto();
    const first = await brandsService.createBrand(dto);
    createdBrandIds.push(first.id);

    await expect(
      brandsService.createBrand(buildCreateBrandDto({ slug: dto.slug })),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects creating a brand with an already-used domain', async () => {
    const domain = `${randomUUID().slice(0, 8)}.example.com`;
    const first = await brandsService.createBrand(buildCreateBrandDto({ domain }));
    createdBrandIds.push(first.id);

    await expect(brandsService.createBrand(buildCreateBrandDto({ domain }))).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('normalizes the domain to lowercase without a www. prefix at creation time', async () => {
    const unique = randomUUID().slice(0, 8);
    const brand = await brandsService.createBrand(
      buildCreateBrandDto({ domain: `WWW.${unique}.Example.COM` }),
    );
    createdBrandIds.push(brand.id);

    expect(brand.domain).toBe(`${unique}.example.com`);
  });

  it('rejects an already-used domain even when the new one differs only by case or www.', async () => {
    const unique = randomUUID().slice(0, 8);
    const first = await brandsService.createBrand(
      buildCreateBrandDto({ domain: `${unique}.example.com` }),
    );
    createdBrandIds.push(first.id);

    await expect(
      brandsService.createBrand(buildCreateBrandDto({ domain: `WWW.${unique}.EXAMPLE.COM` })),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('lists and fetches a brand', async () => {
    const created = await brandsService.createBrand(buildCreateBrandDto());
    createdBrandIds.push(created.id);

    const listed = await brandsService.listBrands();
    expect(listed.map((brand) => brand.id)).toContain(created.id);

    const fetched = await brandsService.getBrand(created.id);
    expect(fetched.id).toBe(created.id);
  });

  it('throws NotFoundException for an unknown brand id', async () => {
    await expect(brandsService.getBrand('does-not-exist')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates brand fields', async () => {
    const created = await brandsService.createBrand(buildCreateBrandDto());
    createdBrandIds.push(created.id);

    const updated = await brandsService.updateBrand(created.id, {
      name: 'Renamed Brand',
      themeMode: 'LIGHT',
      buttonColorHex: '#abcdef',
    });

    expect(updated.name).toBe('Renamed Brand');
    expect(updated.themeMode).toBe('LIGHT');
    expect(updated.buttonColorHex).toBe('#abcdef');
  });

  it('sets and toggles a product flag', async () => {
    const created = await brandsService.createBrand(buildCreateBrandDto());
    createdBrandIds.push(created.id);

    const enabled = await brandsService.setProductFlag(created.id, 'CASHOUT', true);
    expect(enabled.productFlags).toEqual([
      expect.objectContaining({ product: 'CASHOUT', enabled: true }),
    ]);

    const disabled = await brandsService.setProductFlag(created.id, 'CASHOUT', false);
    expect(disabled.productFlags).toEqual([
      expect.objectContaining({ product: 'CASHOUT', enabled: false }),
    ]);
  });
});
