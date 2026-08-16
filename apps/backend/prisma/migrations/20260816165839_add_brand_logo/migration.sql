-- CreateTable
CREATE TABLE "brand_logos" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_logos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brand_logos_brandId_key" ON "brand_logos"("brandId");

-- AddForeignKey
ALTER TABLE "brand_logos" ADD CONSTRAINT "brand_logos_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
