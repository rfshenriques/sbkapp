-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'HOMEPAGE_CAROUSEL_CONFIG_SET';

-- CreateTable
CREATE TABLE "homepage_carousel_configs" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "autoScrollSeconds" INTEGER NOT NULL DEFAULT 6,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homepage_carousel_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "homepage_carousel_configs_brandId_key" ON "homepage_carousel_configs"("brandId");

-- AddForeignKey
ALTER TABLE "homepage_carousel_configs" ADD CONSTRAINT "homepage_carousel_configs_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
