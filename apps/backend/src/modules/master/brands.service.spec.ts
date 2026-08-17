import { randomUUID } from 'node:crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { BrandsService } from './brands.service';
import type { ColorZone } from './dto/brand-color';
import type { CreateBrandDto } from './dto/create-brand.dto';

function buildCreateBrandDto(overrides: Partial<CreateBrandDto> = {}): CreateBrandDto {
  const unique = randomUUID().slice(0, 8);
  return {
    name: `Test Brand ${unique}`,
    slug: `test-brand-${unique}`,
    ...overrides,
  };
}

function solidZone(hex: string): ColorZone {
  return { light: { type: 'solid', hex }, dark: { type: 'solid', hex } };
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
      logoLightUrl: 'https://example.com/logo-light.png',
      logoDarkUrl: 'https://example.com/logo-dark.png',
      themeMode: 'LIGHT',
      buttonColor: solidZone('#112233'),
      highlightColor: solidZone('#445566'),
      filterColor: solidZone('#778899'),
    });

    const brand = await brandsService.createBrand(dto);
    createdBrandIds.push(brand.id);

    expect(brand.name).toBe(dto.name);
    expect(brand.slug).toBe(dto.slug);
    expect(brand.domain).toBe(dto.domain);
    expect(brand.themeMode).toBe('LIGHT');
    expect(brand.logoLightUrl).toBe('https://example.com/logo-light.png');
    expect(brand.logoDarkUrl).toBe('https://example.com/logo-dark.png');
    expect(brand.buttonColor).toEqual(solidZone('#112233'));
    expect(brand.highlightColor).toEqual(solidZone('#445566'));
    expect(brand.filterColor).toEqual(solidZone('#778899'));
    expect(brand.productFlags).toEqual([]);
  });

  it('defaults a new brand to dark appearance when themeMode is not given', async () => {
    const brand = await brandsService.createBrand(buildCreateBrandDto());
    createdBrandIds.push(brand.id);

    expect(brand.themeMode).toBe('DARK');
  });

  it('defaults a new brand to EUR and lets it be set and later changed', async () => {
    const created = await brandsService.createBrand(buildCreateBrandDto());
    createdBrandIds.push(created.id);
    expect(created.currencyCode).toBe('EUR');

    const withUsd = await brandsService.createBrand(buildCreateBrandDto({ currencyCode: 'USD' }));
    createdBrandIds.push(withUsd.id);
    expect(withUsd.currencyCode).toBe('USD');

    const updated = await brandsService.updateBrand(withUsd.id, { currencyCode: 'GBP' });
    expect(updated.currencyCode).toBe('GBP');
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
      buttonColor: solidZone('#abcdef'),
    });

    expect(updated.name).toBe('Renamed Brand');
    expect(updated.themeMode).toBe('LIGHT');
    expect(updated.buttonColor).toEqual(solidZone('#abcdef'));
  });

  it('accepts a gradient color for a zone', async () => {
    const created = await brandsService.createBrand(buildCreateBrandDto());
    createdBrandIds.push(created.id);

    const gradientZone: ColorZone = {
      light: { type: 'gradient', direction: 'to-r', fromHex: '#ff0000', toHex: '#0000ff' },
      dark: { type: 'solid', hex: '#112233' },
    };
    const updated = await brandsService.updateBrand(created.id, { highlightColor: gradientZone });

    expect(updated.highlightColor).toEqual(gradientZone);
  });

  it('defaults freebetStakeReturnedOnWin to true and lets it be toggled off', async () => {
    const created = await brandsService.createBrand(buildCreateBrandDto());
    createdBrandIds.push(created.id);
    expect(created.freebetStakeReturnedOnWin).toBe(true);

    const updated = await brandsService.updateBrand(created.id, { freebetStakeReturnedOnWin: false });
    expect(updated.freebetStakeReturnedOnWin).toBe(false);
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

  describe('logo upload', () => {
    it('stores the uploaded bytes and points the matching *Url field at the public serving path', async () => {
      const created = await brandsService.createBrand(buildCreateBrandDto());
      createdBrandIds.push(created.id);

      const updated = await brandsService.setLogo(
        created.id,
        'SITE_LIGHT',
        Buffer.from('fake-png-bytes'),
        'image/png',
      );
      expect(updated.logoLightUrl).toBe(`/backend/public/brands/${created.id}/logo/SITE_LIGHT`);
      expect(updated.logoDarkUrl).toBeNull();

      const stored = await brandsService.getLogoData(created.id, 'SITE_LIGHT');
      expect(stored?.mimeType).toBe('image/png');
      expect(Buffer.from(stored!.data).toString()).toBe('fake-png-bytes');
    });

    it('each of the 4 slots is independent - uploading one never touches the others', async () => {
      const created = await brandsService.createBrand(buildCreateBrandDto());
      createdBrandIds.push(created.id);

      await brandsService.setLogo(created.id, 'SITE_LIGHT', Buffer.from('site-light'), 'image/png');
      const updated = await brandsService.setLogo(created.id, 'SHARE_DARK', Buffer.from('share-dark'), 'image/png');

      expect(updated.logoLightUrl).toBe(`/backend/public/brands/${created.id}/logo/SITE_LIGHT`);
      expect(updated.shareLogoDarkUrl).toBe(`/backend/public/brands/${created.id}/logo/SHARE_DARK`);
      expect(updated.logoDarkUrl).toBeNull();
      expect(updated.shareLogoLightUrl).toBeNull();
    });

    it('re-uploading to the same slot replaces the previous logo in place', async () => {
      const created = await brandsService.createBrand(buildCreateBrandDto());
      createdBrandIds.push(created.id);

      await brandsService.setLogo(created.id, 'SITE_LIGHT', Buffer.from('first'), 'image/png');
      await brandsService.setLogo(created.id, 'SITE_LIGHT', Buffer.from('second'), 'image/webp');

      const stored = await brandsService.getLogoData(created.id, 'SITE_LIGHT');
      expect(stored?.mimeType).toBe('image/webp');
      expect(Buffer.from(stored!.data).toString()).toBe('second');
    });

    it('removes a logo from one slot and clears just that field', async () => {
      const created = await brandsService.createBrand(buildCreateBrandDto());
      createdBrandIds.push(created.id);
      await brandsService.setLogo(created.id, 'SITE_LIGHT', Buffer.from('bytes'), 'image/png');
      await brandsService.setLogo(created.id, 'SITE_DARK', Buffer.from('bytes'), 'image/png');

      const updated = await brandsService.removeLogo(created.id, 'SITE_LIGHT');
      expect(updated.logoLightUrl).toBeNull();
      expect(updated.logoDarkUrl).not.toBeNull();
      expect(await brandsService.getLogoData(created.id, 'SITE_LIGHT')).toBeNull();
      expect(await brandsService.getLogoData(created.id, 'SITE_DARK')).not.toBeNull();
    });

    it('throws NotFoundException when uploading a logo for an unknown brand', async () => {
      await expect(
        brandsService.setLogo('does-not-exist', 'SITE_LIGHT', Buffer.from('bytes'), 'image/png'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
