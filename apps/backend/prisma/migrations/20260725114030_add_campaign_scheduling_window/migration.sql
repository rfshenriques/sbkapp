-- AlterTable
ALTER TABLE "bet_and_get_campaigns" ADD COLUMN     "endAt" TIMESTAMP(3),
ADD COLUMN     "startAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "deposit_campaigns" ADD COLUMN     "endAt" TIMESTAMP(3),
ADD COLUMN     "startAt" TIMESTAMP(3);
