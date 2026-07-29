-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'REGISTER_CAMPAIGN_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'REGISTER_CAMPAIGN_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'REGISTER_CAMPAIGN_REMOVED';
ALTER TYPE "AuditAction" ADD VALUE 'LEADERBOARD_CAMPAIGN_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'LEADERBOARD_CAMPAIGN_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'LEADERBOARD_CAMPAIGN_REMOVED';
ALTER TYPE "AuditAction" ADD VALUE 'LEADERBOARD_CAMPAIGN_SCOPES_SET';
ALTER TYPE "AuditAction" ADD VALUE 'LEADERBOARD_CAMPAIGN_REWARD_TIERS_SET';
ALTER TYPE "AuditAction" ADD VALUE 'LEADERBOARD_CAMPAIGN_PRIZES_GRANTED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FreebetSource" ADD VALUE 'REGISTER_CAMPAIGN';
ALTER TYPE "FreebetSource" ADD VALUE 'LEADERBOARD_CAMPAIGN';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PushNotificationKind" ADD VALUE 'REGISTER_CAMPAIGN';
ALTER TYPE "PushNotificationKind" ADD VALUE 'LEADERBOARD_CAMPAIGN';

-- AlterTable
ALTER TABLE "bets" ADD COLUMN     "registerCampaignRedemptionId" TEXT;

-- AlterTable
ALTER TABLE "promo_cards" ADD COLUMN     "leaderboardCampaignId" TEXT,
ADD COLUMN     "registerCampaignId" TEXT;

-- AlterTable
ALTER TABLE "push_notifications" ADD COLUMN     "leaderboardCampaignId" TEXT,
ADD COLUMN     "registerCampaignId" TEXT;

-- CreateTable
CREATE TABLE "register_campaigns" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "rewardType" "BetAndGetRewardType" NOT NULL DEFAULT 'FIXED',
    "rewardAmountCents" INTEGER,
    "rewardPercent" DOUBLE PRECISION,
    "rewardCapCents" INTEGER,
    "requiresBet" BOOLEAN NOT NULL DEFAULT false,
    "qualifyingBetWindowDays" INTEGER,
    "trigger" "BetAndGetTrigger" NOT NULL DEFAULT 'PLACEMENT',
    "triggerOnWon" BOOLEAN NOT NULL DEFAULT false,
    "triggerOnLost" BOOLEAN NOT NULL DEFAULT false,
    "triggerOnVoid" BOOLEAN NOT NULL DEFAULT false,
    "minStakeCents" INTEGER,
    "minOddsPerLeg" DOUBLE PRECISION,
    "betType" "BetAndGetBetType" NOT NULL DEFAULT 'EITHER',
    "minSelections" INTEGER,
    "audienceMode" "AudienceMode" NOT NULL DEFAULT 'ALL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "register_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "register_campaign_segments" (
    "id" TEXT NOT NULL,
    "registerCampaignId" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,

    CONSTRAINT "register_campaign_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "register_campaign_redemptions" (
    "id" TEXT NOT NULL,
    "registerCampaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "rewardAmountCents" INTEGER,
    "status" "DepositCampaignRedemptionStatus" NOT NULL DEFAULT 'PENDING_BET',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "register_campaign_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard_campaigns" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3) NOT NULL,
    "pointsPerEuroStaked" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "useCombinedOddsAsMultiplier" BOOLEAN NOT NULL DEFAULT false,
    "onlySettledWonCounts" BOOLEAN NOT NULL DEFAULT true,
    "minStakeCents" INTEGER,
    "minOddsPerLeg" DOUBLE PRECISION,
    "minCombinedOdds" DOUBLE PRECISION,
    "betType" "BetAndGetBetType" NOT NULL DEFAULT 'EITHER',
    "minSelections" INTEGER,
    "bettingTiming" "BetAndGetTiming" NOT NULL DEFAULT 'EITHER',
    "audienceMode" "AudienceMode" NOT NULL DEFAULT 'ALL',
    "prizesGrantedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leaderboard_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard_campaign_segments" (
    "id" TEXT NOT NULL,
    "leaderboardCampaignId" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,

    CONSTRAINT "leaderboard_campaign_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard_campaign_scopes" (
    "id" TEXT NOT NULL,
    "leaderboardCampaignId" TEXT NOT NULL,
    "scopeType" "BetAndGetScopeType" NOT NULL,
    "scopeValue" TEXT NOT NULL,

    CONSTRAINT "leaderboard_campaign_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard_reward_tiers" (
    "id" TEXT NOT NULL,
    "leaderboardCampaignId" TEXT NOT NULL,
    "rankFrom" INTEGER NOT NULL,
    "rankTo" INTEGER NOT NULL,
    "rewardAmountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leaderboard_reward_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard_entries" (
    "id" TEXT NOT NULL,
    "leaderboardCampaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "pointsTotal" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leaderboard_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard_entry_bets" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "leaderboardCampaignId" TEXT NOT NULL,
    "betId" TEXT NOT NULL,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "countedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leaderboard_entry_bets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "register_campaigns_brandId_idx" ON "register_campaigns"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "register_campaign_segments_registerCampaignId_segmentId_key" ON "register_campaign_segments"("registerCampaignId", "segmentId");

-- CreateIndex
CREATE INDEX "register_campaign_redemptions_status_idx" ON "register_campaign_redemptions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "register_campaign_redemptions_registerCampaignId_userId_key" ON "register_campaign_redemptions"("registerCampaignId", "userId");

-- CreateIndex
CREATE INDEX "leaderboard_campaigns_brandId_idx" ON "leaderboard_campaigns"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "leaderboard_campaign_segments_leaderboardCampaignId_segment_key" ON "leaderboard_campaign_segments"("leaderboardCampaignId", "segmentId");

-- CreateIndex
CREATE INDEX "leaderboard_campaign_scopes_leaderboardCampaignId_idx" ON "leaderboard_campaign_scopes"("leaderboardCampaignId");

-- CreateIndex
CREATE INDEX "leaderboard_reward_tiers_leaderboardCampaignId_idx" ON "leaderboard_reward_tiers"("leaderboardCampaignId");

-- CreateIndex
CREATE UNIQUE INDEX "leaderboard_reward_tiers_leaderboardCampaignId_rankFrom_key" ON "leaderboard_reward_tiers"("leaderboardCampaignId", "rankFrom");

-- CreateIndex
CREATE INDEX "leaderboard_entries_leaderboardCampaignId_pointsTotal_idx" ON "leaderboard_entries"("leaderboardCampaignId", "pointsTotal");

-- CreateIndex
CREATE UNIQUE INDEX "leaderboard_entries_leaderboardCampaignId_userId_key" ON "leaderboard_entries"("leaderboardCampaignId", "userId");

-- CreateIndex
CREATE INDEX "leaderboard_entry_bets_leaderboardCampaignId_idx" ON "leaderboard_entry_bets"("leaderboardCampaignId");

-- CreateIndex
CREATE UNIQUE INDEX "leaderboard_entry_bets_entryId_betId_key" ON "leaderboard_entry_bets"("entryId", "betId");

-- CreateIndex
CREATE UNIQUE INDEX "bets_registerCampaignRedemptionId_key" ON "bets"("registerCampaignRedemptionId");

-- AddForeignKey
ALTER TABLE "bets" ADD CONSTRAINT "bets_registerCampaignRedemptionId_fkey" FOREIGN KEY ("registerCampaignRedemptionId") REFERENCES "register_campaign_redemptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_cards" ADD CONSTRAINT "promo_cards_registerCampaignId_fkey" FOREIGN KEY ("registerCampaignId") REFERENCES "register_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_cards" ADD CONSTRAINT "promo_cards_leaderboardCampaignId_fkey" FOREIGN KEY ("leaderboardCampaignId") REFERENCES "leaderboard_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "register_campaigns" ADD CONSTRAINT "register_campaigns_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "register_campaign_segments" ADD CONSTRAINT "register_campaign_segments_registerCampaignId_fkey" FOREIGN KEY ("registerCampaignId") REFERENCES "register_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "register_campaign_segments" ADD CONSTRAINT "register_campaign_segments_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "player_segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "register_campaign_redemptions" ADD CONSTRAINT "register_campaign_redemptions_registerCampaignId_fkey" FOREIGN KEY ("registerCampaignId") REFERENCES "register_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "register_campaign_redemptions" ADD CONSTRAINT "register_campaign_redemptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "register_campaign_redemptions" ADD CONSTRAINT "register_campaign_redemptions_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_campaigns" ADD CONSTRAINT "leaderboard_campaigns_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_campaign_segments" ADD CONSTRAINT "leaderboard_campaign_segments_leaderboardCampaignId_fkey" FOREIGN KEY ("leaderboardCampaignId") REFERENCES "leaderboard_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_campaign_segments" ADD CONSTRAINT "leaderboard_campaign_segments_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "player_segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_campaign_scopes" ADD CONSTRAINT "leaderboard_campaign_scopes_leaderboardCampaignId_fkey" FOREIGN KEY ("leaderboardCampaignId") REFERENCES "leaderboard_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_reward_tiers" ADD CONSTRAINT "leaderboard_reward_tiers_leaderboardCampaignId_fkey" FOREIGN KEY ("leaderboardCampaignId") REFERENCES "leaderboard_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_entries" ADD CONSTRAINT "leaderboard_entries_leaderboardCampaignId_fkey" FOREIGN KEY ("leaderboardCampaignId") REFERENCES "leaderboard_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_entries" ADD CONSTRAINT "leaderboard_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_entries" ADD CONSTRAINT "leaderboard_entries_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_entry_bets" ADD CONSTRAINT "leaderboard_entry_bets_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "leaderboard_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_entry_bets" ADD CONSTRAINT "leaderboard_entry_bets_betId_fkey" FOREIGN KEY ("betId") REFERENCES "bets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_notifications" ADD CONSTRAINT "push_notifications_registerCampaignId_fkey" FOREIGN KEY ("registerCampaignId") REFERENCES "register_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_notifications" ADD CONSTRAINT "push_notifications_leaderboardCampaignId_fkey" FOREIGN KEY ("leaderboardCampaignId") REFERENCES "leaderboard_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

