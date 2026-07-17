-- CreateEnum
CREATE TYPE "SelectionStatus" AS ENUM ('OPEN', 'WON', 'LOST', 'VOID');

-- AlterTable
ALTER TABLE "bet_selections" ADD COLUMN     "status" "SelectionStatus" NOT NULL DEFAULT 'OPEN';

-- AlterTable
ALTER TABLE "bets" ADD COLUMN     "settledAt" TIMESTAMP(3),
ADD COLUMN     "settledPayoutCents" INTEGER;

