-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'ACCA_ROLLBACK_CONFIG_SET';

-- CreateTable
CREATE TABLE "acca_rollback_configs" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "minSelections" INTEGER NOT NULL DEFAULT 3,
    "lossThreshold" INTEGER NOT NULL DEFAULT 1,
    "rewardPercent" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acca_rollback_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "acca_rollback_configs_brandId_key" ON "acca_rollback_configs"("brandId");

-- AddForeignKey
ALTER TABLE "acca_rollback_configs" ADD CONSTRAINT "acca_rollback_configs_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

