-- CreateEnum
CREATE TYPE "BrandImageListKind" AS ENUM ('SPONSOR_LOGO', 'PAYMENT_METHOD');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'BRAND_IMAGE_LIST_ITEM_ADDED';
ALTER TYPE "AuditAction" ADD VALUE 'BRAND_IMAGE_LIST_ITEM_REMOVED';
ALTER TYPE "AuditAction" ADD VALUE 'BRAND_IMAGE_LIST_REORDERED';

-- AlterTable
ALTER TABLE "brands" ADD COLUMN     "supportHelplineText" TEXT;

-- CreateTable
CREATE TABLE "brand_image_list_items" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "kind" "BrandImageListKind" NOT NULL,
    "data" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_image_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "brand_image_list_items_brandId_kind_idx" ON "brand_image_list_items"("brandId", "kind");

-- AddForeignKey
ALTER TABLE "brand_image_list_items" ADD CONSTRAINT "brand_image_list_items_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
