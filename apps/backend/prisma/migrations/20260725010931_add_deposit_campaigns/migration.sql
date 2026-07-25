-- CreateEnum
CREATE TYPE "DepositRewardType" AS ENUM ('FIXED', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "DepositCampaignRedemptionStatus" AS ENUM ('PENDING_BET', 'PENDING_SETTLEMENT', 'GRANTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'DEPOSIT_CAMPAIGN_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'DEPOSIT_CAMPAIGN_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'DEPOSIT_CAMPAIGN_REMOVED';

-- AlterEnum
ALTER TYPE "FreebetSource" ADD VALUE 'DEPOSIT_CAMPAIGN';

-- AlterTable
ALTER TABLE "bets" ADD COLUMN     "depositCampaignRedemptionId" TEXT;

-- AlterTable
ALTER TABLE "promo_cards" ADD COLUMN     "depositCampaignId" TEXT;

-- CreateTable
CREATE TABLE "deposit_campaigns" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "minDepositAmountCents" INTEGER NOT NULL,
    "rewardType" "DepositRewardType" NOT NULL,
    "fixedRewardAmountCents" INTEGER,
    "rewardPercent" DOUBLE PRECISION,
    "rewardCapCents" INTEGER,
    "requiresBet" BOOLEAN NOT NULL DEFAULT false,
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
    "audienceMode" "AudienceMode" NOT NULL DEFAULT 'ALL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deposit_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposit_campaign_segments" (
    "id" TEXT NOT NULL,
    "depositCampaignId" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,

    CONSTRAINT "deposit_campaign_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposits" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deposits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposit_campaign_redemptions" (
    "id" TEXT NOT NULL,
    "depositCampaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "depositId" TEXT NOT NULL,
    "rewardAmountCents" INTEGER NOT NULL,
    "status" "DepositCampaignRedemptionStatus" NOT NULL DEFAULT 'PENDING_BET',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deposit_campaign_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deposit_campaigns_brandId_idx" ON "deposit_campaigns"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "deposit_campaign_segments_depositCampaignId_segmentId_key" ON "deposit_campaign_segments"("depositCampaignId", "segmentId");

-- CreateIndex
CREATE INDEX "deposits_userId_idx" ON "deposits"("userId");

-- CreateIndex
CREATE INDEX "deposit_campaign_redemptions_userId_depositCampaignId_idx" ON "deposit_campaign_redemptions"("userId", "depositCampaignId");

-- CreateIndex
CREATE INDEX "deposit_campaign_redemptions_status_idx" ON "deposit_campaign_redemptions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "bets_depositCampaignRedemptionId_key" ON "bets"("depositCampaignRedemptionId");

-- AddForeignKey
ALTER TABLE "bets" ADD CONSTRAINT "bets_depositCampaignRedemptionId_fkey" FOREIGN KEY ("depositCampaignRedemptionId") REFERENCES "deposit_campaign_redemptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_cards" ADD CONSTRAINT "promo_cards_depositCampaignId_fkey" FOREIGN KEY ("depositCampaignId") REFERENCES "deposit_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_campaigns" ADD CONSTRAINT "deposit_campaigns_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_campaign_segments" ADD CONSTRAINT "deposit_campaign_segments_depositCampaignId_fkey" FOREIGN KEY ("depositCampaignId") REFERENCES "deposit_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_campaign_segments" ADD CONSTRAINT "deposit_campaign_segments_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "player_segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_campaign_redemptions" ADD CONSTRAINT "deposit_campaign_redemptions_depositCampaignId_fkey" FOREIGN KEY ("depositCampaignId") REFERENCES "deposit_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_campaign_redemptions" ADD CONSTRAINT "deposit_campaign_redemptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_campaign_redemptions" ADD CONSTRAINT "deposit_campaign_redemptions_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_campaign_redemptions" ADD CONSTRAINT "deposit_campaign_redemptions_depositId_fkey" FOREIGN KEY ("depositId") REFERENCES "deposits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

