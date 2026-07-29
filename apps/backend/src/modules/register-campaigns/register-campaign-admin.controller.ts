import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../admin/roles.decorator';
import { RolesGuard } from '../admin/roles.guard';
import { StaffJwtAuthGuard } from '../admin/staff-jwt-auth.guard';
import type { StaffJwtPayload } from '../admin/staff-jwt.strategy';
import { PromoCardAutoSyncService } from '../promo-cards/promo-card-auto-sync.service';
import { CreateRegisterCampaignDto } from './dto/create-register-campaign.dto';
import { UpdateRegisterCampaignDto } from './dto/update-register-campaign.dto';
import { RegisterCampaignService } from './register-campaign.service';

interface AuthenticatedStaffRequest {
  user: StaffJwtPayload;
}

@UseGuards(StaffJwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'TRADING')
@Controller('admin/register-campaigns')
export class RegisterCampaignAdminController {
  constructor(
    private readonly registerCampaignService: RegisterCampaignService,
    private readonly promoCardAutoSyncService: PromoCardAutoSyncService,
  ) {}

  @Get()
  list(@Req() req: AuthenticatedStaffRequest) {
    return this.registerCampaignService.list(req.user.brandId);
  }

  @Get(':id')
  get(@Param('id') id: string, @Req() req: AuthenticatedStaffRequest) {
    return this.registerCampaignService.get(req.user.brandId, id);
  }

  @Post()
  async create(@Body() dto: CreateRegisterCampaignDto, @Req() req: AuthenticatedStaffRequest) {
    const { startAt, endAt, ...rest } = dto;
    const actor = { id: req.user.sub, username: req.user.username, brandId: req.user.brandId };
    const campaign = await this.registerCampaignService.create(
      req.user.brandId,
      { ...rest, startAt: startAt ? new Date(startAt) : null, endAt: endAt ? new Date(endAt) : null },
      actor,
    );
    await this.promoCardAutoSyncService.ensureForRegisterCampaign(req.user.brandId, campaign, actor);
    return campaign;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateRegisterCampaignDto, @Req() req: AuthenticatedStaffRequest) {
    const { startAt, endAt, ...rest } = dto;
    const actor = { id: req.user.sub, username: req.user.username, brandId: req.user.brandId };
    const campaign = await this.registerCampaignService.update(
      req.user.brandId,
      id,
      {
        ...rest,
        ...(startAt !== undefined ? { startAt: startAt ? new Date(startAt) : null } : {}),
        ...(endAt !== undefined ? { endAt: endAt ? new Date(endAt) : null } : {}),
      },
      actor,
    );
    await this.promoCardAutoSyncService.ensureForRegisterCampaign(req.user.brandId, campaign, actor);
    return campaign;
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedStaffRequest) {
    return this.registerCampaignService.remove(req.user.brandId, id, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }
}
