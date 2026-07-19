-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'COMPETITION_RANKING_SET';
ALTER TYPE "AuditAction" ADD VALUE 'COMPETITION_RANKING_REMOVED';

-- CreateTable
CREATE TABLE "competition_rankings" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "competition" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competition_rankings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "competition_rankings_brandId_idx" ON "competition_rankings"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "competition_rankings_brandId_competition_key" ON "competition_rankings"("brandId", "competition");

-- AddForeignKey
ALTER TABLE "competition_rankings" ADD CONSTRAINT "competition_rankings_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed a sensible default ranking for the Default Brand (see
-- 20260718170000_add_brand_id_retrofit) so "most important first" sorting
-- has real data to work with before any backoffice editing happens.
-- Competition names match the-odds-api.com's sport_title verbatim, exactly
-- as captured from a real GET /v4/sports response (2026-07-19) - see
-- RELEVANT_SPORT_KEYS in apps/odds-engine/src/providers/the-odds-api/events-service.ts.
INSERT INTO "competition_rankings" ("id", "brandId", "competition", "rank", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'FIFA World Cup', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'UEFA Champions League Qualification', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'EPL', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'La Liga - Spain', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Bundesliga - Germany', 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Serie A - Italy', 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Ligue 1 - France', 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Dutch Eredivisie', 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'NFL', 8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'NHL', 9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'MMA', 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Boxing', 11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("brandId", "competition") DO NOTHING;
