import { Body, Controller, Delete, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt.strategy';
import { SubscribePushDto, UnsubscribePushDto } from './dto/subscribe-push.dto';
import { PushSubscriptionService } from './push-subscription.service';

interface AuthenticatedRequest {
  user: JwtPayload;
}

/** Player-facing push subscription management - one device (browser) at a time, see PushSubscriptionService. */
@UseGuards(JwtAuthGuard)
@Controller('push')
export class PushController {
  constructor(private readonly pushSubscriptionService: PushSubscriptionService) {}

  @Get('subscriptions')
  listSubscriptions(@Req() req: AuthenticatedRequest) {
    return this.pushSubscriptionService.listForUser(req.user.sub);
  }

  @Post('subscribe')
  subscribe(@Body() dto: SubscribePushDto, @Req() req: AuthenticatedRequest) {
    return this.pushSubscriptionService.subscribe({
      userId: req.user.sub,
      endpoint: dto.endpoint,
      p256dh: dto.keys.p256dh,
      auth: dto.keys.auth,
      userAgent: dto.userAgent,
    });
  }

  @Delete('subscribe')
  unsubscribe(@Body() dto: UnsubscribePushDto, @Req() req: AuthenticatedRequest) {
    return this.pushSubscriptionService.unsubscribe(req.user.sub, dto.endpoint);
  }
}
