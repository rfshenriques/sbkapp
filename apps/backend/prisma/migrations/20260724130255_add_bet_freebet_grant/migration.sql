-- AlterTable
ALTER TABLE "bets" ADD COLUMN     "freebetGrantId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "bets_freebetGrantId_key" ON "bets"("freebetGrantId");

-- AddForeignKey
ALTER TABLE "bets" ADD CONSTRAINT "bets_freebetGrantId_fkey" FOREIGN KEY ("freebetGrantId") REFERENCES "freebet_grants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

