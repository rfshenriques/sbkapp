-- AlterEnum
ALTER TYPE "BrandLogoSlot" ADD VALUE 'APP_ICON';

-- AlterTable
ALTER TABLE "brands" ADD COLUMN "appIconUrl" TEXT;
