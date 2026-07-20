import { randomUUID } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from '../admin/audit-log.service';
import { BrandImagesService } from './brand-images.service';
import { PublicBrandImagesController } from './public-brand-images.controller';

function mockResponse() {
  return { set: vi.fn() } as unknown as Response;
}

describe('PublicBrandImagesController', () => {
  let moduleRef: TestingModule;
  let controller: PublicBrandImagesController;
  let service: BrandImagesService;
  let prisma: PrismaService;
  let brandId: string;
  let TEST_ACTOR: AuditActor;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      controllers: [PublicBrandImagesController],
      providers: [BrandImagesService, PrismaService, AuditLogService],
    }).compile();
    await moduleRef.init();

    controller = moduleRef.get(PublicBrandImagesController);
    service = moduleRef.get(BrandImagesService);
    prisma = moduleRef.get(PrismaService);

    const unique = randomUUID();
    const brand = await prisma.brand.create({
      data: { name: `Public Image Brand ${unique}`, slug: `public-image-brand-${unique}` },
    });
    brandId = brand.id;
    TEST_ACTOR = { id: 'staff-test-id', username: 'test_public_images', brandId };
  });

  afterEach(async () => {
    await prisma.brandImage.deleteMany({ where: { brandId } });
    await prisma.brand.delete({ where: { id: brandId } });
    await moduleRef.close();
  });

  it('streams the stored bytes with the stored content type', async () => {
    await service.setImage(brandId, 'HOMEPAGE_OFFER', Buffer.from('png-bytes'), 'image/png', TEST_ACTOR);
    const res = mockResponse();

    const file = await controller.getImage(brandId, 'HOMEPAGE_OFFER', res);

    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({ 'Content-Type': 'image/png' }),
    );
    const streamed = await file.getStream().toArray();
    expect(Buffer.concat(streamed).toString()).toBe('png-bytes');
  });

  it('404s when the slot has no image set', async () => {
    const res = mockResponse();

    await expect(controller.getImage(brandId, 'REGISTER_MOBILE', res)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
