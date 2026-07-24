-- CreateEnum
CREATE TYPE "LimitScope" AS ENUM ('GLOBAL', 'SPORT', 'COUNTRY', 'LEAGUE', 'MARKET');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'STAKE_LIMIT_SET';
ALTER TYPE "AuditAction" ADD VALUE 'STAKE_LIMIT_REMOVED';
ALTER TYPE "AuditAction" ADD VALUE 'STAKE_LIMITS_BULK_IMPORTED';

-- CreateTable
CREATE TABLE "stake_limits" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "scope" "LimitScope" NOT NULL,
    "scopeValue" TEXT NOT NULL DEFAULT '',
    "tier" INTEGER NOT NULL DEFAULT 0,
    "maxStakeCents" INTEGER,
    "maxLiabilityCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stake_limits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stake_limits_brandId_idx" ON "stake_limits"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "stake_limits_brandId_scope_scopeValue_tier_key" ON "stake_limits"("brandId", "scope", "scopeValue", "tier");

-- AddForeignKey
ALTER TABLE "stake_limits" ADD CONSTRAINT "stake_limits_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
