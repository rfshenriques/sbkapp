-- Existing margin_configs rows have no sport of record and predate this
-- dimension entirely (all local dev/test data) - clearing them out is
-- simpler and safer than guessing a sport for each, and lets `sport` be
-- added as a genuinely required column instead of a nullable stand-in.
TRUNCATE TABLE "margin_configs";

-- DropIndex
DROP INDEX "margin_configs_brandId_marketName_tier_key";

-- AlterTable
ALTER TABLE "margin_configs" ADD COLUMN "sport" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "margin_configs_brandId_sport_marketName_tier_key" ON "margin_configs"("brandId", "sport", "marketName", "tier");
