import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';
import { PlayerSegmentModule } from '../player-segments/player-segment.module';
import { PublicPushController } from './public-push.controller';
import { PushAdminController } from './push-admin.controller';
import { PushController } from './push.controller';
import { PushNotificationService } from './push-notification.service';
import { PushSubscriptionService } from './push-subscription.service';

@Module({
  imports: [AdminModule, AuthModule, PlayerSegmentModule],
  controllers: [PushController, PublicPushController, PushAdminController],
  providers: [PushSubscriptionService, PushNotificationService],
  exports: [PushNotificationService],
})
export class PushModule {}
