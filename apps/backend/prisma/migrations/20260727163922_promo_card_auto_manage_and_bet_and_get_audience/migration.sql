-- DropForeignKey
ALTER TABLE "promo_cards" DROP CONSTRAINT "promo_cards_betAndGetCampaignId_fkey";

-- DropForeignKey
ALTER TABLE "promo_cards" DROP CONSTRAINT "promo_cards_depositCampaignId_fkey";

-- AlterTable
ALTER TABLE "bet_and_get_campaigns" ADD COLUMN     "audienceMode" "AudienceMode" NOT NULL DEFAULT 'ALL';

-- AlterTable
ALTER TABLE "promo_cards" ADD COLUMN     "autoCreated" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "data" DROP NOT NULL,
ALTER COLUMN "mimeType" DROP NOT NULL;

-- CreateTable
CREATE TABLE "bet_and_get_campaign_segments" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,

    CONSTRAINT "bet_and_get_campaign_segments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bet_and_get_campaign_segments_campaignId_segmentId_key" ON "bet_and_get_campaign_segments"("campaignId", "segmentId");

-- AddForeignKey
ALTER TABLE "bet_and_get_campaign_segments" ADD CONSTRAINT "bet_and_get_campaign_segments_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "bet_and_get_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bet_and_get_campaign_segments" ADD CONSTRAINT "bet_and_get_campaign_segments_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "player_segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_cards" ADD CONSTRAINT "promo_cards_betAndGetCampaignId_fkey" FOREIGN KEY ("betAndGetCampaignId") REFERENCES "bet_and_get_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_cards" ADD CONSTRAINT "promo_cards_depositCampaignId_fkey" FOREIGN KEY ("depositCampaignId") REFERENCES "deposit_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
