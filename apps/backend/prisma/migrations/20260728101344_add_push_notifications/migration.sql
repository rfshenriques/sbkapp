-- CreateEnum
CREATE TYPE "PushNotificationKind" AS ENUM ('CUSTOM', 'BET_WON', 'BET_AND_GET_CAMPAIGN', 'DEPOSIT_CAMPAIGN');

-- CreateEnum
CREATE TYPE "PushDeliveryStatus" AS ENUM ('SENT', 'FAILED');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'PUSH_NOTIFICATION_SENT';

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_notifications" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "kind" "PushNotificationKind" NOT NULL DEFAULT 'CUSTOM',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "targetUrl" TEXT,
    "audienceMode" "AudienceMode" NOT NULL DEFAULT 'ALL',
    "betAndGetCampaignId" TEXT,
    "depositCampaignId" TEXT,
    "sourceBetId" TEXT,
    "ttlSeconds" INTEGER NOT NULL DEFAULT 86400,
    "sentByStaffUserId" TEXT,
    "sentByUsername" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_notification_segments" (
    "id" TEXT NOT NULL,
    "pushNotificationId" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,

    CONSTRAINT "push_notification_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_notification_recipients" (
    "id" TEXT NOT NULL,
    "pushNotificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pushSubscriptionId" TEXT,
    "endpoint" TEXT NOT NULL,
    "status" "PushDeliveryStatus" NOT NULL,
    "statusCode" INTEGER,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_notification_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_userId_idx" ON "push_subscriptions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "push_notifications_sourceBetId_key" ON "push_notifications"("sourceBetId");

-- CreateIndex
CREATE INDEX "push_notifications_brandId_idx" ON "push_notifications"("brandId");

-- CreateIndex
CREATE INDEX "push_notifications_createdAt_idx" ON "push_notifications"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "push_notification_segments_pushNotificationId_segmentId_key" ON "push_notification_segments"("pushNotificationId", "segmentId");

-- CreateIndex
CREATE INDEX "push_notification_recipients_pushNotificationId_idx" ON "push_notification_recipients"("pushNotificationId");

-- CreateIndex
CREATE INDEX "push_notification_recipients_userId_idx" ON "push_notification_recipients"("userId");

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_notifications" ADD CONSTRAINT "push_notifications_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_notifications" ADD CONSTRAINT "push_notifications_betAndGetCampaignId_fkey" FOREIGN KEY ("betAndGetCampaignId") REFERENCES "bet_and_get_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_notifications" ADD CONSTRAINT "push_notifications_depositCampaignId_fkey" FOREIGN KEY ("depositCampaignId") REFERENCES "deposit_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_notification_segments" ADD CONSTRAINT "push_notification_segments_pushNotificationId_fkey" FOREIGN KEY ("pushNotificationId") REFERENCES "push_notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_notification_segments" ADD CONSTRAINT "push_notification_segments_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "player_segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_notification_recipients" ADD CONSTRAINT "push_notification_recipients_pushNotificationId_fkey" FOREIGN KEY ("pushNotificationId") REFERENCES "push_notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_notification_recipients" ADD CONSTRAINT "push_notification_recipients_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_notification_recipients" ADD CONSTRAINT "push_notification_recipients_pushSubscriptionId_fkey" FOREIGN KEY ("pushSubscriptionId") REFERENCES "push_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
