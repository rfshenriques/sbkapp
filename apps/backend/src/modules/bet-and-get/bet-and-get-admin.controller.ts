import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../admin/roles.decorator';
import { RolesGuard } from '../admin/roles.guard';
import { StaffJwtAuthGuard } from '../admin/staff-jwt-auth.guard';
import type { StaffJwtPayload } from '../admin/staff-jwt.strategy';
import { PromoCardAutoSyncService } from '../promo-cards/promo-card-auto-sync.service';
import { BetAndGetCampaignService } from './bet-and-get-campaign.service';
import { CreateBetAndGetCampaignDto } from './dto/create-bet-and-get-campaign.dto';
import { SetCampaignScopesDto } from './dto/set-campaign-scopes.dto';
import { UpdateBetAndGetCampaignDto } from './dto/update-bet-and-get-campaign.dto';

interface AuthenticatedStaffRequest {
  user: StaffJwtPayload;
}

@UseGuards(StaffJwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'TRADING')
@Controller('admin/bet-and-get-campaigns')
export class BetAndGetAdminController {
  constructor(
    private readonly betAndGetCampaignService: BetAndGetCampaignService,
    private readonly promoCardAutoSyncService: PromoCardAutoSyncService,
  ) {}

  @Get()
  list(@Req() req: AuthenticatedStaffRequest) {
    return this.betAndGetCampaignService.list(req.user.brandId);
  }

  @Get(':id')
  get(@Param('id') id: string, @Req() req: AuthenticatedStaffRequest) {
    return this.betAndGetCampaignService.get(req.user.brandId, id);
  }

  @Post()
  async create(@Body() dto: CreateBetAndGetCampaignDto, @Req() req: AuthenticatedStaffRequest) {
    const { startAt, endAt, ...rest } = dto;
    const actor = { id: req.user.sub, username: req.user.username, brandId: req.user.brandId };
    const campaign = await this.betAndGetCampaignService.create(
      req.user.brandId,
      { ...rest, startAt: startAt ? new Date(startAt) : null, endAt: endAt ? new Date(endAt) : null },
      actor,
    );
    await this.promoCardAutoSyncService.ensureForBetAndGetCampaign(req.user.brandId, campaign, actor);
    return campaign;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateBetAndGetCampaignDto, @Req() req: AuthenticatedStaffRequest) {
    const { startAt, endAt, ...rest } = dto;
    const actor = { id: req.user.sub, username: req.user.username, brandId: req.user.brandId };
    const campaign = await this.betAndGetCampaignService.update(
      req.user.brandId,
      id,
      {
        ...rest,
        ...(startAt !== undefined ? { startAt: startAt ? new Date(startAt) : null } : {}),
        ...(endAt !== undefined ? { endAt: endAt ? new Date(endAt) : null } : {}),
      },
      actor,
    );
    await this.promoCardAutoSyncService.ensureForBetAndGetCampaign(req.user.brandId, campaign, actor);
    return campaign;
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedStaffRequest) {
    return this.betAndGetCampaignService.remove(req.user.brandId, id, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }

  @Patch(':id/scopes')
  setScopes(@Param('id') id: string, @Body() dto: SetCampaignScopesDto, @Req() req: AuthenticatedStaffRequest) {
    return this.betAndGetCampaignService.setScopes(req.user.brandId, id, dto.scopes, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }
}
