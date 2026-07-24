-- CreateEnum
CREATE TYPE "BetAndGetTrigger" AS ENUM ('PLACEMENT', 'SETTLEMENT');

-- CreateEnum
CREATE TYPE "BetAndGetBetType" AS ENUM ('SINGLES_ONLY', 'ACCUMULATOR_ONLY', 'EITHER');

-- CreateEnum
CREATE TYPE "BetAndGetScopeType" AS ENUM ('SPORT', 'COMPETITION', 'MATCH');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'BET_AND_GET_CAMPAIGN_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'BET_AND_GET_CAMPAIGN_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'BET_AND_GET_CAMPAIGN_REMOVED';
ALTER TYPE "AuditAction" ADD VALUE 'BET_AND_GET_CAMPAIGN_SCOPES_SET';
ALTER TYPE "AuditAction" ADD VALUE 'BET_AND_GET_CAMPAIGN_BANNER_SET';

-- AlterEnum
ALTER TYPE "FreebetSource" ADD VALUE 'BET_AND_GET';

-- AlterTable
ALTER TABLE "bets" ADD COLUMN     "betAndGetCampaignId" TEXT;

-- AlterTable
ALTER TABLE "freebet_grants" ADD COLUMN     "sourceCampaignId" TEXT;

-- CreateTable
CREATE TABLE "bet_and_get_campaigns" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "rewardAmountCents" INTEGER NOT NULL,
    "trigger" "BetAndGetTrigger" NOT NULL DEFAULT 'PLACEMENT',
    "triggerOnWon" BOOLEAN NOT NULL DEFAULT false,
    "triggerOnLost" BOOLEAN NOT NULL DEFAULT false,
    "triggerOnVoid" BOOLEAN NOT NULL DEFAULT false,
    "minStakeCents" INTEGER,
    "minOddsPerLeg" DOUBLE PRECISION,
    "betType" "BetAndGetBetType" NOT NULL DEFAULT 'EITHER',
    "minSelections" INTEGER,
    "allowMultipleRedemptions" BOOLEAN NOT NULL DEFAULT false,
    "maxRedemptionsPerPlayer" INTEGER,
    "bannerData" BYTEA,
    "bannerMimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bet_and_get_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bet_and_get_campaign_scopes" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "scopeType" "BetAndGetScopeType" NOT NULL,
    "scopeValue" TEXT NOT NULL,

    CONSTRAINT "bet_and_get_campaign_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bet_and_get_campaigns_brandId_idx" ON "bet_and_get_campaigns"("brandId");

-- CreateIndex
CREATE INDEX "bet_and_get_campaign_scopes_campaignId_idx" ON "bet_and_get_campaign_scopes"("campaignId");

-- CreateIndex
CREATE INDEX "bets_betAndGetCampaignId_idx" ON "bets"("betAndGetCampaignId");

-- CreateIndex
CREATE INDEX "freebet_grants_sourceCampaignId_idx" ON "freebet_grants"("sourceCampaignId");

-- AddForeignKey
ALTER TABLE "bets" ADD CONSTRAINT "bets_betAndGetCampaignId_fkey" FOREIGN KEY ("betAndGetCampaignId") REFERENCES "bet_and_get_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bet_and_get_campaigns" ADD CONSTRAINT "bet_and_get_campaigns_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bet_and_get_campaign_scopes" ADD CONSTRAINT "bet_and_get_campaign_scopes_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "bet_and_get_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

