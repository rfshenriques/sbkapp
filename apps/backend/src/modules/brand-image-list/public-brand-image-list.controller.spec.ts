import { randomUUID } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { BrandImageListService } from './brand-image-list.service';
import { PublicBrandImageListController } from './public-brand-image-list.controller';

function mockResponse() {
  return { set: vi.fn() } as unknown as Response;
}

describe('PublicBrandImageListController', () => {
  let moduleRef: TestingModule;
  let controller: PublicBrandImageListController;
  let service: BrandImageListService;
  let prisma: PrismaService;
  let brandId: string;
  let TEST_ACTOR: AuditActor;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      controllers: [PublicBrandImageListController],
      providers: [BrandImageListService, PrismaService, AuditLogService],
    }).compile();
    await moduleRef.init();

    controller = moduleRef.get(PublicBrandImageListController);
    service = moduleRef.get(BrandImageListService);
    prisma = moduleRef.get(PrismaService);

    const unique = randomUUID();
    const brand = await prisma.brand.create({
      data: { name: `Public Image List Brand ${unique}`, slug: `public-image-list-brand-${unique}` },
    });
    brandId = brand.id;
    TEST_ACTOR = { id: 'staff-test-id', username: 'test_public_image_list', brandId };
  });

  afterEach(async () => {
    await prisma.brandImageListItem.deleteMany({ where: { brandId } });
    await prisma.brand.delete({ where: { id: brandId } });
    await moduleRef.close();
  });

  it('lists metadata for a kind, in sortOrder', async () => {
    await service.add(brandId, 'SPONSOR_LOGO', Buffer.from('a'), 'image/png', TEST_ACTOR);
    await service.add(brandId, 'SPONSOR_LOGO', Buffer.from('b'), 'image/png', TEST_ACTOR);

    const items = await controller.list(brandId, 'SPONSOR_LOGO');
    expect(items).toHaveLength(2);
    expect(items[0]).not.toHaveProperty('data');
  });

  it('streams an item\'s stored bytes with the stored content type', async () => {
    const item = await service.add(brandId, 'PAYMENT_METHOD', Buffer.from('visa-bytes'), 'image/png', TEST_ACTOR);
    const res = mockResponse();

    const file = await controller.getItem(brandId, item.id, res);

    expect(res.set).toHaveBeenCalledWith(expect.objectContaining({ 'Content-Type': 'image/png' }));
    const streamed = await file.getStream().toArray();
    expect(Buffer.concat(streamed).toString()).toBe('visa-bytes');
  });

  it('404s for an item that does not exist', async () => {
    const res = mockResponse();

    await expect(controller.getItem(brandId, 'does-not-exist', res)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("404s for another brand's item, even with a valid id", async () => {
    const item = await service.add(brandId, 'SPONSOR_LOGO', Buffer.from('a'), 'image/png', TEST_ACTOR);
    const res = mockResponse();

    await expect(controller.getItem('some-other-brand-id', item.id, res)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
