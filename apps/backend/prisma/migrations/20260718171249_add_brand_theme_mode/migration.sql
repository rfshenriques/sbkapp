-- CreateEnum
CREATE TYPE "ThemeMode" AS ENUM ('LIGHT', 'DARK');

-- AlterTable
ALTER TABLE "brands" ADD COLUMN     "themeMode" "ThemeMode" NOT NULL DEFAULT 'DARK';
