-- Retrofit: every player, staff account, bet, audit entry, and market
-- suspension now belongs to exactly one brand. See PROJECT_BRIEF.md
-- Section 10 for the full reasoning.
--
-- This adds brandId as NOT NULL directly (no nullable-then-backfill
-- steps) because users/staff_users/bets/audit_log_entries/market_suspensions
-- are guaranteed empty in every environment this migration runs against
-- today (a fresh local dev DB, or CI's ephemeral Postgres) - there is no
-- real production data yet to backfill. If this ever needs to run against
-- an environment with existing rows, add the columns nullable, backfill
-- them to a real brand's id, then add the NOT NULL constraint instead.
--
-- Seeds one deterministic "Default Brand" (fixed UUID, not
-- randomly generated) so local dev/CI can rely on a known brand id
-- without a manual bootstrap step - apps/frontend's .env.example points
-- at this same id until real domain-based tenant resolution exists.
INSERT INTO "brands" ("id", "name", "slug", "createdAt", "updatedAt")
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Brand', 'default', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- DropIndex
DROP INDEX "market_suspensions_matchId_idx";

-- DropIndex
DROP INDEX "market_suspensions_matchId_marketId_key";

-- AlterTable
ALTER TABLE "audit_log_entries" ADD COLUMN     "brandId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "bets" ADD COLUMN     "brandId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "market_suspensions" ADD COLUMN     "brandId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "staff_users" ADD COLUMN     "brandId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "brandId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "audit_log_entries_brandId_idx" ON "audit_log_entries"("brandId");

-- CreateIndex
CREATE INDEX "bets_brandId_idx" ON "bets"("brandId");

-- CreateIndex
CREATE INDEX "market_suspensions_brandId_matchId_idx" ON "market_suspensions"("brandId", "matchId");

-- CreateIndex
CREATE UNIQUE INDEX "market_suspensions_brandId_matchId_marketId_key" ON "market_suspensions"("brandId", "matchId", "marketId");

-- CreateIndex
CREATE INDEX "staff_users_brandId_idx" ON "staff_users"("brandId");

-- CreateIndex
CREATE INDEX "users_brandId_idx" ON "users"("brandId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_users" ADD CONSTRAINT "staff_users_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log_entries" ADD CONSTRAINT "audit_log_entries_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bets" ADD CONSTRAINT "bets_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_suspensions" ADD CONSTRAINT "market_suspensions_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
