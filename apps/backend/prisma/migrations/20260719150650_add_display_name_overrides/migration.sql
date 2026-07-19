-- CreateEnum
CREATE TYPE "DisplayNameEntityType" AS ENUM ('SPORT', 'COUNTRY', 'COMPETITION', 'TEAM');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'DISPLAY_NAME_OVERRIDE_SET';

-- CreateTable
CREATE TABLE "display_name_overrides" (
    "id" TEXT NOT NULL,
    "entityType" "DisplayNameEntityType" NOT NULL,
    "rawName" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "display_name_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "display_name_overrides_entityType_rawName_key" ON "display_name_overrides"("entityType", "rawName");
