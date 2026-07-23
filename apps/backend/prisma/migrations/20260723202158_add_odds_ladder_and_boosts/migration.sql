-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'ODDS_LADDER_RUNG_ADDED';
ALTER TYPE "AuditAction" ADD VALUE 'ODDS_LADDER_RUNG_REMOVED';
ALTER TYPE "AuditAction" ADD VALUE 'ODDS_LADDER_REGENERATED';
ALTER TYPE "AuditAction" ADD VALUE 'BOOST_SET';
ALTER TYPE "AuditAction" ADD VALUE 'BOOST_CLEARED';

-- CreateTable
CREATE TABLE "odds_ladder_rungs" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "odds_ladder_rungs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boosts" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "selectionId" TEXT NOT NULL,
    "ticks" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boosts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "odds_ladder_rungs_brandId_idx" ON "odds_ladder_rungs"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "odds_ladder_rungs_brandId_value_key" ON "odds_ladder_rungs"("brandId", "value");

-- CreateIndex
CREATE INDEX "boosts_brandId_matchId_idx" ON "boosts"("brandId", "matchId");

-- CreateIndex
CREATE UNIQUE INDEX "boosts_brandId_matchId_marketId_selectionId_key" ON "boosts"("brandId", "matchId", "marketId", "selectionId");

-- AddForeignKey
ALTER TABLE "odds_ladder_rungs" ADD CONSTRAINT "odds_ladder_rungs_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boosts" ADD CONSTRAINT "boosts_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
