-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'TEAM_COLOR_SET';

-- CreateTable
CREATE TABLE "team_colors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "colorHex" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_colors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "team_colors_name_key" ON "team_colors"("name");
