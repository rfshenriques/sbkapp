import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../admin/roles.decorator';
import { RolesGuard } from '../admin/roles.guard';
import { StaffJwtAuthGuard } from '../admin/staff-jwt-auth.guard';
import type { StaffJwtPayload } from '../admin/staff-jwt.strategy';
import { SendPushNotificationDto } from './dto/send-push-notification.dto';
import { type AudienceInput, PushNotificationService } from './push-notification.service';

interface AuthenticatedStaffRequest {
  user: StaffJwtPayload;
}

function resolveAudience(dto: SendPushNotificationDto): AudienceInput {
  if (dto.betAndGetCampaignId) {
    return { betAndGetCampaignId: dto.betAndGetCampaignId };
  }
  if (dto.depositCampaignId) {
    return { depositCampaignId: dto.depositCampaignId };
  }
  return { audienceMode: dto.audienceMode ?? 'ALL', segmentIds: dto.segmentIds ?? [] };
}

@UseGuards(StaffJwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'CRM')
@Controller('admin/push-notifications')
export class PushAdminController {
  constructor(private readonly pushNotificationService: PushNotificationService) {}

  @Get()
  list(@Req() req: AuthenticatedStaffRequest) {
    return this.pushNotificationService.listHistory(req.user.brandId);
  }

  @Get(':id')
  get(@Param('id') id: string, @Req() req: AuthenticatedStaffRequest) {
    return this.pushNotificationService.getDetail(req.user.brandId, id);
  }

  @Post()
  send(@Body() dto: SendPushNotificationDto, @Req() req: AuthenticatedStaffRequest) {
    return this.pushNotificationService.send(
      req.user.brandId,
      {
        title: dto.title,
        body: dto.body,
        targetUrl: dto.targetUrl,
        audience: resolveAudience(dto),
        kind: dto.betAndGetCampaignId ? 'BET_AND_GET_CAMPAIGN' : dto.depositCampaignId ? 'DEPOSIT_CAMPAIGN' : 'CUSTOM',
      },
      { id: req.user.sub, username: req.user.username, brandId: req.user.brandId },
    );
  }
}
