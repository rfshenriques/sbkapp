-- CreateTable
CREATE TABLE "master_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_refresh_tokens" (
    "id" TEXT NOT NULL,
    "masterUserId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "master_refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "domain" TEXT,
    "logoUrl" TEXT,
    "buttonColorHex" TEXT,
    "highlightColorHex" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_product_flags" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "brand_product_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "master_users_email_key" ON "master_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "master_users_username_key" ON "master_users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "master_refresh_tokens_tokenHash_key" ON "master_refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "master_refresh_tokens_masterUserId_idx" ON "master_refresh_tokens"("masterUserId");

-- CreateIndex
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "brands_domain_key" ON "brands"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "brand_product_flags_brandId_product_key" ON "brand_product_flags"("brandId", "product");

-- AddForeignKey
ALTER TABLE "master_refresh_tokens" ADD CONSTRAINT "master_refresh_tokens_masterUserId_fkey" FOREIGN KEY ("masterUserId") REFERENCES "master_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_product_flags" ADD CONSTRAINT "brand_product_flags_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
