/*
  Warnings:

  - You are about to drop the column `freebetGrantId` on the `bets` table. All the data in the column will be lost.
  - You are about to drop the column `spentOnBetId` on the `freebet_grants` table. All the data in the column will be lost.
  - Added the required column `remainingCents` to the `freebet_grants` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "bets" DROP CONSTRAINT "bets_freebetGrantId_fkey";

-- DropIndex
DROP INDEX "bets_freebetGrantId_key";

-- AlterTable
ALTER TABLE "bets" DROP COLUMN "freebetGrantId",
ADD COLUMN     "fundedByFreebets" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "freebet_grants" DROP COLUMN "spentOnBetId",
ADD COLUMN     "remainingCents" INTEGER;

-- Backfill: under the old atomic-grant model a SPENT grant always had its
-- whole amountCents consumed in one shot, and only an ACTIVE (never
-- partially-spent) grant could ever be VOIDED - so every existing row's
-- remaining balance is fully determined by its status alone.
UPDATE "freebet_grants" SET "remainingCents" = CASE WHEN "status" = 'SPENT' THEN 0 ELSE "amountCents" END;

ALTER TABLE "freebet_grants" ALTER COLUMN "remainingCents" SET NOT NULL;

-- CreateTable
CREATE TABLE "bet_freebet_debits" (
    "id" TEXT NOT NULL,
    "betId" TEXT NOT NULL,
    "freebetGrantId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bet_freebet_debits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bet_freebet_debits_betId_idx" ON "bet_freebet_debits"("betId");

-- CreateIndex
CREATE INDEX "bet_freebet_debits_freebetGrantId_idx" ON "bet_freebet_debits"("freebetGrantId");

-- AddForeignKey
ALTER TABLE "bet_freebet_debits" ADD CONSTRAINT "bet_freebet_debits_betId_fkey" FOREIGN KEY ("betId") REFERENCES "bets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bet_freebet_debits" ADD CONSTRAINT "bet_freebet_debits_freebetGrantId_fkey" FOREIGN KEY ("freebetGrantId") REFERENCES "freebet_grants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
