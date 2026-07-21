-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'COMPETITION_TIER_SET';
ALTER TYPE "AuditAction" ADD VALUE 'COMPETITION_TIER_REMOVED';
ALTER TYPE "AuditAction" ADD VALUE 'MARGIN_CONFIG_SET';
ALTER TYPE "AuditAction" ADD VALUE 'MARGIN_CONFIG_REMOVED';

-- CreateTable
CREATE TABLE "competition_tiers" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "competition" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competition_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "margin_configs" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "marketName" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "marginPercent" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "margin_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "competition_tiers_brandId_idx" ON "competition_tiers"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "competition_tiers_brandId_competition_key" ON "competition_tiers"("brandId", "competition");

-- CreateIndex
CREATE INDEX "margin_configs_brandId_idx" ON "margin_configs"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "margin_configs_brandId_marketName_tier_key" ON "margin_configs"("brandId", "marketName", "tier");

-- AddForeignKey
ALTER TABLE "competition_tiers" ADD CONSTRAINT "competition_tiers_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "margin_configs" ADD CONSTRAINT "margin_configs_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
