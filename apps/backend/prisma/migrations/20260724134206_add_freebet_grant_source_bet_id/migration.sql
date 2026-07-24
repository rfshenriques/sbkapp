-- AlterTable
ALTER TABLE "freebet_grants" ADD COLUMN     "sourceBetId" TEXT;

-- CreateIndex
CREATE INDEX "freebet_grants_sourceBetId_idx" ON "freebet_grants"("sourceBetId");

