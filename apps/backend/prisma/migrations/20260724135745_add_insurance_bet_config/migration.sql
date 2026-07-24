-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'INSURANCE_BET_CONFIG_SET';

-- AlterTable
ALTER TABLE "bets" ADD COLUMN     "insuranceCostPercent" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "insurance_bet_configs" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "costPercent" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurance_bet_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "insurance_bet_configs_brandId_key" ON "insurance_bet_configs"("brandId");

-- AddForeignKey
ALTER TABLE "insurance_bet_configs" ADD CONSTRAINT "insurance_bet_configs_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

