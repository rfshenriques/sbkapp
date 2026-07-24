-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'PLAYER_SEGMENT_COLOR_SET';

-- AlterTable
ALTER TABLE "player_segments" ADD COLUMN     "colorHex" TEXT;

