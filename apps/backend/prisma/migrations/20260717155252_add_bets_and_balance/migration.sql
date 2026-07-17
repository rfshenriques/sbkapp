-- CreateEnum
CREATE TYPE "BetStatus" AS ENUM ('PENDING', 'WON', 'LOST', 'VOID');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "balanceCents" INTEGER NOT NULL DEFAULT 100000;

-- CreateTable
CREATE TABLE "bets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stakeCents" INTEGER NOT NULL,
    "combinedOdds" DECIMAL(10,4) NOT NULL,
    "potentialPayoutCents" INTEGER NOT NULL,
    "status" "BetStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bet_selections" (
    "id" TEXT NOT NULL,
    "betId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "selectionId" TEXT NOT NULL,
    "matchLabel" TEXT NOT NULL,
    "marketName" TEXT NOT NULL,
    "selectionName" TEXT NOT NULL,
    "odds" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "bet_selections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bets_userId_idx" ON "bets"("userId");

-- CreateIndex
CREATE INDEX "bet_selections_betId_idx" ON "bet_selections"("betId");

-- AddForeignKey
ALTER TABLE "bets" ADD CONSTRAINT "bets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bet_selections" ADD CONSTRAINT "bet_selections_betId_fkey" FOREIGN KEY ("betId") REFERENCES "bets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

