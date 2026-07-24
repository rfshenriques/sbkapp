-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'MANUAL_MARKET_AUTO_DISABLED';

-- AlterTable
ALTER TABLE "boosts" ADD COLUMN     "staysLiveDuringInplay" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "manual_markets" ADD COLUMN     "disabledAt" TIMESTAMP(3),
ADD COLUMN     "staysLiveDuringInplay" BOOLEAN NOT NULL DEFAULT false;

