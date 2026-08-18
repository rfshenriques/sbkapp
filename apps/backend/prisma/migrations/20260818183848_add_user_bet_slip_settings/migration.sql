-- AlterTable
ALTER TABLE "users" ADD COLUMN     "betSlipAutoUpdateOdds" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "betSlipQuickStakeCents" INTEGER[] DEFAULT ARRAY[500, 1000, 2500, 5000]::INTEGER[];
