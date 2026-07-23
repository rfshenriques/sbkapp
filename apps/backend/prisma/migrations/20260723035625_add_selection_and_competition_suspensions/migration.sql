-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'COMPETITION_SUSPENDED';
ALTER TYPE "AuditAction" ADD VALUE 'COMPETITION_UNSUSPENDED';

-- AlterTable
ALTER TABLE "market_suspensions" ADD COLUMN     "selectionId" TEXT NOT NULL DEFAULT '';

-- DropIndex
DROP INDEX "market_suspensions_brandId_matchId_marketId_key";

-- CreateIndex
CREATE UNIQUE INDEX "market_suspensions_brandId_matchId_marketId_selectionId_key" ON "market_suspensions"("brandId", "matchId", "marketId", "selectionId");

-- CreateTable
CREATE TABLE "competition_suspensions" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "competition" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competition_suspensions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "competition_suspensions_brandId_idx" ON "competition_suspensions"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "competition_suspensions_brandId_competition_key" ON "competition_suspensions"("brandId", "competition");

-- AddForeignKey
ALTER TABLE "competition_suspensions" ADD CONSTRAINT "competition_suspensions_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
