-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'MARKETING_SPEND_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'MARKETING_SPEND_REMOVED';

-- CreateTable
CREATE TABLE "marketing_spend" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "channel" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdByStaffUserId" TEXT,
    "createdByUsername" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_spend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "marketing_spend_brandId_date_idx" ON "marketing_spend"("brandId", "date");

-- AddForeignKey
ALTER TABLE "marketing_spend" ADD CONSTRAINT "marketing_spend_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
