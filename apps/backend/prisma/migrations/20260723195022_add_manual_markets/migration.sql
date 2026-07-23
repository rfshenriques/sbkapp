-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'MANUAL_MARKET_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'MANUAL_MARKET_REMOVED';

-- CreateTable
CREATE TABLE "manual_markets" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manual_markets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manual_market_selections" (
    "id" TEXT NOT NULL,
    "manualMarketId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "odds" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manual_market_selections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "manual_markets_brandId_matchId_idx" ON "manual_markets"("brandId", "matchId");

-- AddForeignKey
ALTER TABLE "manual_markets" ADD CONSTRAINT "manual_markets_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_market_selections" ADD CONSTRAINT "manual_market_selections_manualMarketId_fkey" FOREIGN KEY ("manualMarketId") REFERENCES "manual_markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
