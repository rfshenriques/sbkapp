-- CreateEnum
CREATE TYPE "FreebetStatus" AS ENUM ('ACTIVE', 'SPENT', 'VOIDED');

-- CreateEnum
CREATE TYPE "FreebetSource" AS ENUM ('MANUAL', 'ACCA_ROLLBACK', 'INSURANCE_BET');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'FREEBET_GRANTED';
ALTER TYPE "AuditAction" ADD VALUE 'FREEBET_VOIDED';

-- CreateTable
CREATE TABLE "freebet_grants" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "source" "FreebetSource" NOT NULL,
    "note" TEXT,
    "status" "FreebetStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "spentAt" TIMESTAMP(3),
    "spentOnBetId" TEXT,
    "voidedAt" TIMESTAMP(3),
    "createdByStaffUserId" TEXT,
    "createdByUsername" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "freebet_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "freebet_grants_userId_status_idx" ON "freebet_grants"("userId", "status");

-- CreateIndex
CREATE INDEX "freebet_grants_brandId_idx" ON "freebet_grants"("brandId");

-- AddForeignKey
ALTER TABLE "freebet_grants" ADD CONSTRAINT "freebet_grants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "freebet_grants" ADD CONSTRAINT "freebet_grants_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
