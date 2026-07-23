-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'ACCA_BOOST_CONFIG_SET';

-- AlterTable
ALTER TABLE "bets" ADD COLUMN     "accaBoostPercent" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "acca_boost_configs" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "boostPercentPerLeg" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "minSelections" INTEGER NOT NULL DEFAULT 3,
    "minOddsPerLeg" DOUBLE PRECISION NOT NULL DEFAULT 1.2,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acca_boost_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "acca_boost_configs_brandId_key" ON "acca_boost_configs"("brandId");

-- AddForeignKey
ALTER TABLE "acca_boost_configs" ADD CONSTRAINT "acca_boost_configs_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
