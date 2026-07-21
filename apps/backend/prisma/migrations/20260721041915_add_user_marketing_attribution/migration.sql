-- AlterTable
ALTER TABLE "users" ADD COLUMN     "referrerUrl" TEXT,
ADD COLUMN     "utmCampaign" TEXT,
ADD COLUMN     "utmMedium" TEXT,
ADD COLUMN     "utmSource" TEXT;
