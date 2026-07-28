-- CreateEnum
CREATE TYPE "BetAndGetTiming" AS ENUM ('PREMATCH_ONLY', 'INPLAY_ONLY', 'EITHER');

-- AlterTable
ALTER TABLE "bet_and_get_campaigns" ADD COLUMN     "bettingTiming" "BetAndGetTiming" NOT NULL DEFAULT 'EITHER';

-- AlterTable
ALTER TABLE "bets" ADD COLUMN     "winNotifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "freebet_grants" ADD COLUMN     "notifiedAt" TIMESTAMP(3);
