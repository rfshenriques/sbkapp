-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'COMPETITION_QUICKLINK_SET';
ALTER TYPE "AuditAction" ADD VALUE 'COMPETITION_QUICKLINK_REMOVED';

-- CreateTable
CREATE TABLE "competition_quicklinks" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "competition" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competition_quicklinks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "competition_quicklinks_brandId_idx" ON "competition_quicklinks"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "competition_quicklinks_brandId_competition_key" ON "competition_quicklinks"("brandId", "competition");

-- AddForeignKey
ALTER TABLE "competition_quicklinks" ADD CONSTRAINT "competition_quicklinks_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
