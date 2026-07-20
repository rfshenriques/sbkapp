-- CreateEnum
CREATE TYPE "BrandImageSlot" AS ENUM ('REGISTER_DESKTOP', 'REGISTER_MOBILE', 'HOMEPAGE_OFFER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'BRAND_IMAGE_SET';
ALTER TYPE "AuditAction" ADD VALUE 'BRAND_IMAGE_REMOVED';

-- CreateTable
CREATE TABLE "brand_images" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "slot" "BrandImageSlot" NOT NULL,
    "data" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "brand_images_brandId_idx" ON "brand_images"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "brand_images_brandId_slot_key" ON "brand_images"("brandId", "slot");

-- AddForeignKey
ALTER TABLE "brand_images" ADD CONSTRAINT "brand_images_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
