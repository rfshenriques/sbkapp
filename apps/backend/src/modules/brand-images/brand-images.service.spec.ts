import { randomUUID } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { BrandImagesService } from './brand-images.service';

describe('BrandImagesService', () => {
  let moduleRef: TestingModule;
  let service: BrandImagesService;
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
    TEST_ACTOR = { id: 'staff-test-id', username: 'test_cms_images', brandId: brandAId };
    OTHER_BRAND_ACTOR = { id: 'staff-test-id-b', username: 'test_cms_images_b', brandId: brandBId };
  });

  afterAll(async () => {
    await setupPrisma.brand.delete({ where: { id: brandAId } });
    await setupPrisma.brand.delete({ where: { id: brandBId } });
    await setupPrisma.$disconnect();
  });

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [BrandImagesService, PrismaService, AuditLogService],
    }).compile();
    await moduleRef.init();

    service = moduleRef.get(BrandImagesService);
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.auditLogEntry.deleteMany({
      where: { actorUsername: { in: [TEST_ACTOR.username, OTHER_BRAND_ACTOR.username] } },
    });
    await prisma.brandImage.deleteMany({ where: { brandId: { in: [brandAId, brandBId] } } });
    await moduleRef.close();
  });

  it('sets an image and lists its metadata back, without the raw bytes', async () => {
    await service.setImage(brandAId, 'HOMEPAGE_OFFER', Buffer.from('fake-png-bytes'), 'image/png', TEST_ACTOR);

    const images = await service.list(brandAId);
    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({ brandId: brandAId, slot: 'HOMEPAGE_OFFER', mimeType: 'image/png' });
    expect(images[0]).not.toHaveProperty('data');
  });

  it('is idempotent - uploading to an already-set slot replaces it instead of duplicating', async () => {
    await service.setImage(brandAId, 'HOMEPAGE_OFFER', Buffer.from('first'), 'image/png', TEST_ACTOR);
    await service.setImage(brandAId, 'HOMEPAGE_OFFER', Buffer.from('second'), 'image/webp', TEST_ACTOR);

    const images = await prisma.brandImage.findMany({ where: { brandId: brandAId, slot: 'HOMEPAGE_OFFER' } });
    expect(images).toHaveLength(1);
    expect(images[0]?.mimeType).toBe('image/webp');
    expect(Buffer.from(images[0]!.data).toString()).toBe('second');
  });

  it('getImageData returns the raw bytes for serving', async () => {
    await service.setImage(brandAId, 'REGISTER_DESKTOP', Buffer.from('desktop-bytes'), 'image/jpeg', TEST_ACTOR);

    const image = await service.getImageData(brandAId, 'REGISTER_DESKTOP');
    expect(Buffer.from(image!.data).toString()).toBe('desktop-bytes');
    expect(image?.mimeType).toBe('image/jpeg');
  });

  it('removing an image deletes it', async () => {
    await service.setImage(brandAId, 'REGISTER_MOBILE', Buffer.from('mobile'), 'image/png', TEST_ACTOR);
    await service.removeImage(brandAId, 'REGISTER_MOBILE', TEST_ACTOR);

    expect(await service.list(brandAId)).toEqual([]);
  });

  it('removing a slot with no image throws NotFoundException', async () => {
    await expect(
      service.removeImage(brandAId, 'REGISTER_MOBILE', TEST_ACTOR),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('records audit entries for set and remove', async () => {
    await service.setImage(brandAId, 'HOMEPAGE_OFFER', Buffer.from('bytes'), 'image/png', TEST_ACTOR);
    await service.removeImage(brandAId, 'HOMEPAGE_OFFER', TEST_ACTOR);

    const entries = await prisma.auditLogEntry.findMany({
      where: { actorUsername: TEST_ACTOR.username },
      orderBy: { createdAt: 'asc' },
    });
    expect(entries.map((entry) => entry.action)).toEqual(['BRAND_IMAGE_SET', 'BRAND_IMAGE_REMOVED']);
    expect(entries[0]?.brandId).toBe(brandAId);
    expect(entries[0]?.metadata).toMatchObject({ slot: 'HOMEPAGE_OFFER' });
  });

  it('is isolated per brand: the same slot set in one brand does not affect another', async () => {
    await service.setImage(brandAId, 'HOMEPAGE_OFFER', Buffer.from('bytes'), 'image/png', TEST_ACTOR);

    expect(await service.list(brandAId)).toHaveLength(1);
    expect(await service.list(brandBId)).toHaveLength(0);
  });

  it("a brand can never remove another brand's image, even for the same slot", async () => {
    await service.setImage(brandAId, 'HOMEPAGE_OFFER', Buffer.from('bytes'), 'image/png', TEST_ACTOR);

    await expect(
      service.removeImage(brandBId, 'HOMEPAGE_OFFER', OTHER_BRAND_ACTOR),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(await service.list(brandAId)).toHaveLength(1);
  });
});
