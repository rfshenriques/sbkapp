-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'ODDS_OVERRIDE_SET';
ALTER TYPE "AuditAction" ADD VALUE 'ODDS_OVERRIDE_CLEARED';

-- CreateTable
CREATE TABLE "odds_overrides" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "selectionId" TEXT NOT NULL,
    "oddsValue" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "odds_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "odds_overrides_brandId_matchId_idx" ON "odds_overrides"("brandId", "matchId");

-- CreateIndex
CREATE UNIQUE INDEX "odds_overrides_brandId_matchId_marketId_selectionId_key" ON "odds_overrides"("brandId", "matchId", "marketId", "selectionId");

-- AddForeignKey
ALTER TABLE "odds_overrides" ADD CONSTRAINT "odds_overrides_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
