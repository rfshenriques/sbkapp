import { Body, Controller, Get, Delete, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../admin/roles.decorator';
import { RolesGuard } from '../admin/roles.guard';
import { StaffJwtAuthGuard } from '../admin/staff-jwt-auth.guard';
import type { StaffJwtPayload } from '../admin/staff-jwt.strategy';
import { PromoCardAutoSyncService } from '../promo-cards/promo-card-auto-sync.service';
import { CreateLeaderboardCampaignDto } from './dto/create-leaderboard-campaign.dto';
import { SetLeaderboardCampaignScopesDto } from './dto/set-campaign-scopes.dto';
import { SetLeaderboardRewardTiersDto } from './dto/set-reward-tiers.dto';
import { UpdateLeaderboardCampaignDto } from './dto/update-leaderboard-campaign.dto';
import { LeaderboardCampaignService } from './leaderboard-campaign.service';

interface AuthenticatedStaffRequest {
  user: StaffJwtPayload;
}

@UseGuards(StaffJwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'TRADING')
@Controller('admin/leaderboard-campaigns')
export class LeaderboardAdminController {
  constructor(
    private readonly leaderboardCampaignService: LeaderboardCampaignService,
    private readonly promoCardAutoSyncService: PromoCardAutoSyncService,
  ) {}

  @Get()
  list(@Req() req: AuthenticatedStaffRequest) {
    return this.leaderboardCampaignService.list(req.user.brandId);
  }

  @Get(':id')
  get(@Param('id') id: string, @Req() req: AuthenticatedStaffRequest) {
    return this.leaderboardCampaignService.get(req.user.brandId, id);
  }

  /** Unmasked - staff need full visibility, same as every other admin list. */
  @Get(':id/entries')
  async getEntries(@Param('id') id: string, @Req() req: AuthenticatedStaffRequest) {
    await this.leaderboardCampaignService.get(req.user.brandId, id);
    return this.leaderboardCampaignService.getRankedEntries(id);
  }

  @Post()
  async create(@Body() dto: CreateLeaderboardCampaignDto, @Req() req: AuthenticatedStaffRequest) {
    const { startAt, endAt, ...rest } = dto;
    const actor = { id: req.user.sub, username: req.user.username, brandId: req.user.brandId };
    const campaign = await this.leaderboardCampaignService.create(
      req.user.brandId,
      { ...rest, startAt: startAt ? new Date(startAt) : null, endAt: new Date(endAt) },
      actor,
    );
    await this.promoCardAutoSyncService.ensureForLeaderboardCampaign(req.user.brandId, campaign, actor);
    return campaign;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateLeaderboardCampaignDto, @Req() req: AuthenticatedStaffRequest) {
    const { startAt, endAt, ...rest } = dto;
    const actor = { id: req.user.sub, username: req.user.username, brandId: req.user.brandId };
    const campaign = await this.leaderboardCampaignService.update(
      req.user.brandId,
      id,
      {
        ...rest,
        ...(startAt !== undefined ? { startAt: startAt ? new Date(startAt) : null } : {}),
        ...(endAt !== undefined ? { endAt: new Date(endAt) } : {}),
      },
      actor,
    );
    await this.promoCardAutoSyncService.ensureForLeaderboardCampaign(req.user.brandId, campaign, actor);
    return campaign;
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedStaffRequest) {
    return this.leaderboardCampaignService.remove(req.user.brandId, id, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }

  @Patch(':id/scopes')
  setScopes(@Param('id') id: string, @Body() dto: SetLeaderboardCampaignScopesDto, @Req() req: AuthenticatedStaffRequest) {
    return this.leaderboardCampaignService.setScopes(req.user.brandId, id, dto.scopes, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }

  @Patch(':id/reward-tiers')
  setRewardTiers(
    @Param('id') id: string,
    @Body() dto: SetLeaderboardRewardTiersDto,
    @Req() req: AuthenticatedStaffRequest,
  ) {
    return this.leaderboardCampaignService.setRewardTiers(req.user.brandId, id, dto.tiers, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }

  /** Explicit "Finalize & Grant Prizes" action - the primary trigger for prize granting (see LeaderboardCampaignService.finalizeIfEnded's doc comment for the lazy read-path safety net that get() also triggers). No-ops before endAt or once already granted. */
  @Post(':id/finalize')
  finalize(@Param('id') id: string, @Req() req: AuthenticatedStaffRequest) {
    return this.leaderboardCampaignService.get(req.user.brandId, id);
  }
}
