-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'MATCH_OF_THE_DAY_ADDED';
ALTER TYPE "AuditAction" ADD VALUE 'MATCH_OF_THE_DAY_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'MATCH_OF_THE_DAY_REMOVED';
ALTER TYPE "AuditAction" ADD VALUE 'MATCH_OF_THE_DAY_REORDERED';

-- CreateTable
CREATE TABLE "match_of_the_day_entries" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_of_the_day_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "match_of_the_day_entries_brandId_sortOrder_idx" ON "match_of_the_day_entries"("brandId", "sortOrder");

-- AddForeignKey
ALTER TABLE "match_of_the_day_entries" ADD CONSTRAINT "match_of_the_day_entries_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
