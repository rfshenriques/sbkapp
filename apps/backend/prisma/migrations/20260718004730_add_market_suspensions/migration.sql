-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'MARKET_SUSPENDED';
ALTER TYPE "AuditAction" ADD VALUE 'MARKET_UNSUSPENDED';

-- CreateTable
CREATE TABLE "market_suspensions" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL DEFAULT '',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_suspensions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "market_suspensions_matchId_idx" ON "market_suspensions"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "market_suspensions_matchId_marketId_key" ON "market_suspensions"("matchId", "marketId");
