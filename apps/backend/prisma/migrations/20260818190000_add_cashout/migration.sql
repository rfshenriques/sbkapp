-- AlterEnum
ALTER TYPE "BetStatus" ADD VALUE 'CASHED_OUT';

-- AlterEnum
ALTER TYPE "DepositCampaignRedemptionStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "bets" ADD COLUMN     "cashedOutAt" TIMESTAMP(3),
ADD COLUMN     "cashedOutValueCents" INTEGER;

-- CreateTable
CREATE TABLE "cashout_configs" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "marginPercent" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cashout_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cashout_configs_brandId_key" ON "cashout_configs"("brandId");

-- AddForeignKey
ALTER TABLE "cashout_configs" ADD CONSTRAINT "cashout_configs_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
