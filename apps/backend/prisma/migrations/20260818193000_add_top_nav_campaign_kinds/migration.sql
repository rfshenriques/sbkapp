-- AlterEnum
ALTER TYPE "TopNavItemKind" ADD VALUE 'BOOSTS';
ALTER TYPE "TopNavItemKind" ADD VALUE 'SPECIALS';
ALTER TYPE "TopNavItemKind" ADD VALUE 'CHALLENGE';
ALTER TYPE "TopNavItemKind" ADD VALUE 'LEADERBOARD';

-- AlterTable
ALTER TABLE "top_nav_items" ADD COLUMN     "betAndGetCampaignId" TEXT,
ADD COLUMN     "leaderboardCampaignId" TEXT;

-- AddForeignKey
ALTER TABLE "top_nav_items" ADD CONSTRAINT "top_nav_items_betAndGetCampaignId_fkey" FOREIGN KEY ("betAndGetCampaignId") REFERENCES "bet_and_get_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "top_nav_items" ADD CONSTRAINT "top_nav_items_leaderboardCampaignId_fkey" FOREIGN KEY ("leaderboardCampaignId") REFERENCES "leaderboard_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
