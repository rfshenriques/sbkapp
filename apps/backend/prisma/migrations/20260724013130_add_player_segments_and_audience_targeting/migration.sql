-- CreateEnum
CREATE TYPE "AudienceMode" AS ENUM ('ALL', 'LOGGED_OUT', 'LOGGED_IN', 'SEGMENTS');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'PLAYER_SEGMENT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'PLAYER_SEGMENT_REMOVED';
ALTER TYPE "AuditAction" ADD VALUE 'PLAYER_SEGMENT_MEMBER_ADDED';
ALTER TYPE "AuditAction" ADD VALUE 'PLAYER_SEGMENT_MEMBER_REMOVED';
ALTER TYPE "AuditAction" ADD VALUE 'MANUAL_MARKET_LIMITS_SET';
ALTER TYPE "AuditAction" ADD VALUE 'BOOST_LIMITS_SET';
ALTER TYPE "AuditAction" ADD VALUE 'BOOST_AUTO_DISABLED';

-- AlterTable
ALTER TABLE "boosts" ADD COLUMN     "audienceMode" "AudienceMode" NOT NULL DEFAULT 'ALL',
ADD COLUMN     "currentLiabilityCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "disabledAt" TIMESTAMP(3),
ADD COLUMN     "maxLiabilityCents" INTEGER,
ADD COLUMN     "maxStakeCents" INTEGER;

-- AlterTable
ALTER TABLE "manual_markets" ADD COLUMN     "audienceMode" "AudienceMode" NOT NULL DEFAULT 'ALL',
ADD COLUMN     "maxLiabilityCents" INTEGER,
ADD COLUMN     "maxStakeCents" INTEGER;

-- CreateTable
CREATE TABLE "player_segments" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_segment_members" (
    "id" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_segment_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manual_market_segments" (
    "id" TEXT NOT NULL,
    "manualMarketId" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,

    CONSTRAINT "manual_market_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boost_segments" (
    "id" TEXT NOT NULL,
    "boostId" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,

    CONSTRAINT "boost_segments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "player_segments_brandId_idx" ON "player_segments"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "player_segments_brandId_name_key" ON "player_segments"("brandId", "name");

-- CreateIndex
CREATE INDEX "player_segment_members_userId_idx" ON "player_segment_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "player_segment_members_segmentId_userId_key" ON "player_segment_members"("segmentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "manual_market_segments_manualMarketId_segmentId_key" ON "manual_market_segments"("manualMarketId", "segmentId");

-- CreateIndex
CREATE UNIQUE INDEX "boost_segments_boostId_segmentId_key" ON "boost_segments"("boostId", "segmentId");

-- AddForeignKey
ALTER TABLE "player_segments" ADD CONSTRAINT "player_segments_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_segment_members" ADD CONSTRAINT "player_segment_members_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "player_segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_segment_members" ADD CONSTRAINT "player_segment_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_market_segments" ADD CONSTRAINT "manual_market_segments_manualMarketId_fkey" FOREIGN KEY ("manualMarketId") REFERENCES "manual_markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_market_segments" ADD CONSTRAINT "manual_market_segments_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "player_segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boost_segments" ADD CONSTRAINT "boost_segments_boostId_fkey" FOREIGN KEY ("boostId") REFERENCES "boosts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boost_segments" ADD CONSTRAINT "boost_segments_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "player_segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
