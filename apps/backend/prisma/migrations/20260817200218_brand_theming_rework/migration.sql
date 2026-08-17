-- CreateEnum
CREATE TYPE "BrandLogoSlot" AS ENUM ('SITE_LIGHT', 'SITE_DARK', 'SHARE_LIGHT', 'SHARE_DARK');

-- AlterTable: add every new column first, old ones stay in place so data can be carried forward below.
ALTER TABLE "brands"
    ADD COLUMN "logoLightUrl" TEXT,
    ADD COLUMN "logoDarkUrl" TEXT,
    ADD COLUMN "shareLogoLightUrl" TEXT,
    ADD COLUMN "shareLogoDarkUrl" TEXT,
    ADD COLUMN "backgroundColor" JSONB,
    ADD COLUMN "buttonColor" JSONB,
    ADD COLUMN "highlightColor" JSONB,
    ADD COLUMN "filterColor" JSONB,
    ADD COLUMN "textColor" JSONB;

-- A brand's old single logo becomes both its light and dark site logo - the
-- byte-serving row is duplicated below to SITE_DARK too, so both URLs
-- actually resolve to real image data instead of one 404ing.
UPDATE "brands" SET "logoLightUrl" = "logoUrl", "logoDarkUrl" = "logoUrl" WHERE "logoUrl" IS NOT NULL;

-- Old single-hex colors become a solid value used for both light and dark -
-- background/text have no prior equivalent, so they stay null (falls back
-- to the fixed built-in default, same as an unset color always has).
UPDATE "brands"
SET "buttonColor" = jsonb_build_object(
        'light', jsonb_build_object('type', 'solid', 'hex', "buttonColorHex"),
        'dark', jsonb_build_object('type', 'solid', 'hex', "buttonColorHex")
    )
WHERE "buttonColorHex" IS NOT NULL;

UPDATE "brands"
SET "highlightColor" = jsonb_build_object(
        'light', jsonb_build_object('type', 'solid', 'hex', "highlightColorHex"),
        'dark', jsonb_build_object('type', 'solid', 'hex', "highlightColorHex")
    )
WHERE "highlightColorHex" IS NOT NULL;

UPDATE "brands"
SET "filterColor" = jsonb_build_object(
        'light', jsonb_build_object('type', 'solid', 'hex', "filterColorHex"),
        'dark', jsonb_build_object('type', 'solid', 'hex', "filterColorHex")
    )
WHERE "filterColorHex" IS NOT NULL;

-- AlterTable
ALTER TABLE "brands"
    DROP COLUMN "logoUrl",
    DROP COLUMN "buttonColorHex",
    DROP COLUMN "highlightColorHex",
    DROP COLUMN "filterColorHex";

-- AlterTable: brand_logos moves from one row per brand to one row per
-- brand+slot. Add the column nullable first so existing rows survive,
-- backfill every existing row as the brand's SITE_LIGHT logo, duplicate it
-- to SITE_DARK too (same "carry the old single logo forward as both" reasoning
-- as logoLightUrl/logoDarkUrl above), then enforce NOT NULL.
ALTER TABLE "brand_logos" ADD COLUMN "slot" "BrandLogoSlot";
UPDATE "brand_logos" SET "slot" = 'SITE_LIGHT';
INSERT INTO "brand_logos" ("id", "brandId", "slot", "data", "mimeType", "createdAt", "updatedAt")
SELECT gen_random_uuid(), "brandId", 'SITE_DARK', "data", "mimeType", "createdAt", "updatedAt"
FROM "brand_logos"
WHERE "slot" = 'SITE_LIGHT';
ALTER TABLE "brand_logos" ALTER COLUMN "slot" SET NOT NULL;

-- DropIndex
DROP INDEX "brand_logos_brandId_key";

-- CreateIndex
CREATE INDEX "brand_logos_brandId_idx" ON "brand_logos"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "brand_logos_brandId_slot_key" ON "brand_logos"("brandId", "slot");
