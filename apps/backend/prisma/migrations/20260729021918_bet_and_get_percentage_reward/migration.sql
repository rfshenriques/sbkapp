-- CreateEnum
CREATE TYPE "BetAndGetRewardType" AS ENUM ('FIXED', 'PERCENTAGE');

-- AlterTable
ALTER TABLE "bet_and_get_campaigns" ADD COLUMN     "rewardCapCents" INTEGER,
ADD COLUMN     "rewardPercent" DOUBLE PRECISION,
ADD COLUMN     "rewardType" "BetAndGetRewardType" NOT NULL DEFAULT 'FIXED',
ALTER COLUMN "rewardAmountCents" DROP NOT NULL;
