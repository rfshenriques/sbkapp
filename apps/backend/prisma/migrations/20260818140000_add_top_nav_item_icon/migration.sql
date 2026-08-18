-- CreateEnum
CREATE TYPE "TopNavIconKey" AS ENUM ('STAR', 'FIRE', 'TROPHY', 'FLAG', 'CALENDAR', 'CLOCK', 'BALL', 'BELL', 'BOLT', 'TARGET', 'GLOBE', 'MEDAL', 'CHART', 'HEART', 'GRID', 'COMPASS');

-- AlterTable
ALTER TABLE "top_nav_items" ADD COLUMN "icon" "TopNavIconKey" NOT NULL DEFAULT 'STAR';
