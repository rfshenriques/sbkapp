import { randomUUID } from 'node:crypto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { BrandImageListService } from './brand-image-list.service';

describe('BrandImageListService', () => {
  let moduleRef: TestingModule;
  let service: BrandImageListService;
  let prisma: PrismaService;
  let setupPrisma: PrismaService;
  let brandAId: string;
  let brandBId: string;
  let TEST_ACTOR: AuditActor;
  let OTHER_BRAND_ACTOR: AuditActor;

  beforeAll(async () => {
    setupPrisma = new PrismaService();
    const unique = randomUUID();
    const brandA = await setupPrisma.brand.create({
      data: { name: `Test Brand A ${unique}`, slug: `test-brand-a-${unique}` },
    });
    const brandB = await setupPrisma.brand.create({
      data: { name: `Test Brand B ${unique}`, slug: `test-brand-b-${unique}` },
    });
    brandAId = brandA.id;
    brandBId = brandB.id;
    TEST_ACTOR = { id: 'staff-test-id', username: 'test_image_list', brandId: brandAId };
    OTHER_BRAND_ACTOR = { id: 'staff-test-id-b', username: 'test_image_list_b', brandId: brandBId };
  });

  afterAll(async () => {
    await setupPrisma.brand.delete({ where: { id: brandAId } });
    await setupPrisma.brand.delete({ where: { id: brandBId } });
    await setupPrisma.$disconnect();
  });

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [BrandImageListService, PrismaService, AuditLogService],
    }).compile();
    await moduleRef.init();

    service = moduleRef.get(BrandImageListService);
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.auditLogEntry.deleteMany({
      where: { actorUsername: { in: [TEST_ACTOR.username, OTHER_BRAND_ACTOR.username] } },
    });
    await prisma.brandImageListItem.deleteMany({ where: { brandId: { in: [brandAId, brandBId] } } });
    await moduleRef.close();
  });

  it('adds items in order and lists them back by sortOrder, without raw bytes', async () => {
    await service.add(brandAId, 'SPONSOR_LOGO', Buffer.from('one'), 'image/png', TEST_ACTOR);
    await service.add(brandAId, 'SPONSOR_LOGO', Buffer.from('two'), 'image/png', TEST_ACTOR);

    const items = await service.list(brandAId, 'SPONSOR_LOGO');
    expect(items).toHaveLength(2);
    expect(items[0]?.sortOrder).toBe(0);
    expect(items[1]?.sortOrder).toBe(1);
    expect(items[0]).not.toHaveProperty('data');
  });

  it('keeps SPONSOR_LOGO and PAYMENT_METHOD lists independent', async () => {
    await service.add(brandAId, 'SPONSOR_LOGO', Buffer.from('logo'), 'image/png', TEST_ACTOR);
    await service.add(brandAId, 'PAYMENT_METHOD', Buffer.from('visa'), 'image/png', TEST_ACTOR);

    expect(await service.list(brandAId, 'SPONSOR_LOGO')).toHaveLength(1);
    expect(await service.list(brandAId, 'PAYMENT_METHOD')).toHaveLength(1);
  });

  it('getItemData returns the raw bytes for serving', async () => {
    const item = await service.add(brandAId, 'SPONSOR_LOGO', Buffer.from('bytes'), 'image/png', TEST_ACTOR);

    const fetched = await service.getItemData(brandAId, item.id);
    expect(Buffer.from(fetched!.data).toString()).toBe('bytes');
  });

  it('removing an item deletes it', async () => {
    const item = await service.add(brandAId, 'SPONSOR_LOGO', Buffer.from('bytes'), 'image/png', TEST_ACTOR);
    await service.remove(brandAId, item.id, TEST_ACTOR);

    expect(await service.list(brandAId, 'SPONSOR_LOGO')).toEqual([]);
  });

  it('removing a nonexistent item throws NotFoundException', async () => {
    await expect(service.remove(brandAId, 'does-not-exist', TEST_ACTOR)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('reorders items to match the given id order', async () => {
    const first = await service.add(brandAId, 'SPONSOR_LOGO', Buffer.from('a'), 'image/png', TEST_ACTOR);
    const second = await service.add(brandAId, 'SPONSOR_LOGO', Buffer.from('b'), 'image/png', TEST_ACTOR);
    const third = await service.add(brandAId, 'SPONSOR_LOGO', Buffer.from('c'), 'image/png', TEST_ACTOR);

    const reordered = await service.reorder(
      brandAId,
      'SPONSOR_LOGO',
      [third.id, first.id, second.id],
      TEST_ACTOR,
    );

    expect(reordered.map((item) => item.id)).toEqual([third.id, first.id, second.id]);
  });

  it('rejects a reorder that omits or adds items', async () => {
    const first = await service.add(brandAId, 'SPONSOR_LOGO', Buffer.from('a'), 'image/png', TEST_ACTOR);
    await service.add(brandAId, 'SPONSOR_LOGO', Buffer.from('b'), 'image/png', TEST_ACTOR);

    await expect(service.reorder(brandAId, 'SPONSOR_LOGO', [first.id], TEST_ACTOR)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('records audit entries for add, remove, and reorder', async () => {
    const item = await service.add(brandAId, 'SPONSOR_LOGO', Buffer.from('a'), 'image/png', TEST_ACTOR);
    await service.reorder(brandAId, 'SPONSOR_LOGO', [item.id], TEST_ACTOR);
    await service.remove(brandAId, item.id, TEST_ACTOR);

    const entries = await prisma.auditLogEntry.findMany({
      where: { actorUsername: TEST_ACTOR.username },
      orderBy: { createdAt: 'asc' },
    });
    expect(entries.map((entry) => entry.action)).toEqual([
      'BRAND_IMAGE_LIST_ITEM_ADDED',
      'BRAND_IMAGE_LIST_REORDERED',
      'BRAND_IMAGE_LIST_ITEM_REMOVED',
    ]);
  });

  it('is isolated per brand: items in one brand do not appear in another', async () => {
    await service.add(brandAId, 'SPONSOR_LOGO', Buffer.from('a'), 'image/png', TEST_ACTOR);

    expect(await service.list(brandAId, 'SPONSOR_LOGO')).toHaveLength(1);
    expect(await service.list(brandBId, 'SPONSOR_LOGO')).toHaveLength(0);
  });

  it("a brand can never remove another brand's item, even by guessing its id", async () => {
    const item = await service.add(brandAId, 'SPONSOR_LOGO', Buffer.from('a'), 'image/png', TEST_ACTOR);

    await expect(service.remove(brandBId, item.id, OTHER_BRAND_ACTOR)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(await service.list(brandAId, 'SPONSOR_LOGO')).toHaveLength(1);
  });
});
