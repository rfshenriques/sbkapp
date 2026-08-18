-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'TOP_NAV_ITEM_ADDED';
ALTER TYPE "AuditAction" ADD VALUE 'TOP_NAV_ITEM_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'TOP_NAV_ITEM_REMOVED';
ALTER TYPE "AuditAction" ADD VALUE 'TOP_NAV_ITEM_REORDERED';

-- CreateEnum
CREATE TYPE "TopNavItemKind" AS ENUM ('SPORT', 'COMPETITION', 'MATCH', 'TODAY', 'TOMORROW');

-- CreateTable
CREATE TABLE "top_nav_items" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "kind" "TopNavItemKind" NOT NULL,
    "label" TEXT NOT NULL,
    "sport" TEXT,
    "competition" TEXT,
    "matchId" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "top_nav_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "top_nav_items_brandId_sortOrder_idx" ON "top_nav_items"("brandId", "sortOrder");

-- AddForeignKey
ALTER TABLE "top_nav_items" ADD CONSTRAINT "top_nav_items_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
