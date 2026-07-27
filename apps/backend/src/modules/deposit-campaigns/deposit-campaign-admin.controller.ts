import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../admin/roles.decorator';
import { RolesGuard } from '../admin/roles.guard';
import { StaffJwtAuthGuard } from '../admin/staff-jwt-auth.guard';
import type { StaffJwtPayload } from '../admin/staff-jwt.strategy';
import { PromoCardAutoSyncService } from '../promo-cards/promo-card-auto-sync.service';
import { DepositCampaignService } from './deposit-campaign.service';
import { CreateDepositCampaignDto } from './dto/create-deposit-campaign.dto';
import { UpdateDepositCampaignDto } from './dto/update-deposit-campaign.dto';

interface AuthenticatedStaffRequest {
  user: StaffJwtPayload;
}

@UseGuards(StaffJwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'TRADING')
@Controller('admin/deposit-campaigns')
export class DepositCampaignAdminController {
  constructor(
    private readonly depositCampaignService: DepositCampaignService,
    private readonly promoCardAutoSyncService: PromoCardAutoSyncService,
  ) {}

  @Get()
  list(@Req() req: AuthenticatedStaffRequest) {
    return this.depositCampaignService.list(req.user.brandId);
  }

  @Get(':id')
  get(@Param('id') id: string, @Req() req: AuthenticatedStaffRequest) {
    return this.depositCampaignService.get(req.user.brandId, id);
  }

  @Post()
  async create(@Body() dto: CreateDepositCampaignDto, @Req() req: AuthenticatedStaffRequest) {
    const { startAt, endAt, ...rest } = dto;
    const actor = { id: req.user.sub, username: req.user.username, brandId: req.user.brandId };
    const campaign = await this.depositCampaignService.create(
      req.user.brandId,
      { ...rest, startAt: startAt ? new Date(startAt) : null, endAt: endAt ? new Date(endAt) : null },
      actor,
    );
    await this.promoCardAutoSyncService.ensureForDepositCampaign(req.user.brandId, campaign, actor);
    return campaign;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateDepositCampaignDto, @Req() req: AuthenticatedStaffRequest) {
    const { startAt, endAt, ...rest } = dto;
    const actor = { id: req.user.sub, username: req.user.username, brandId: req.user.brandId };
    const campaign = await this.depositCampaignService.update(
      req.user.brandId,
      id,
      {
        ...rest,
        ...(startAt !== undefined ? { startAt: startAt ? new Date(startAt) : null } : {}),
        ...(endAt !== undefined ? { endAt: endAt ? new Date(endAt) : null } : {}),
      },
      actor,
    );
    await this.promoCardAutoSyncService.ensureForDepositCampaign(req.user.brandId, campaign, actor);
    return campaign;
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedStaffRequest) {
    return this.depositCampaignService.remove(req.user.brandId, id, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }
}
