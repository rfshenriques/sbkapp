import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../admin/roles.decorator';
import { RolesGuard } from '../admin/roles.guard';
import { StaffJwtAuthGuard } from '../admin/staff-jwt-auth.guard';
import type { StaffJwtPayload } from '../admin/staff-jwt.strategy';
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
  constructor(private readonly depositCampaignService: DepositCampaignService) {}

  @Get()
  list(@Req() req: AuthenticatedStaffRequest) {
    return this.depositCampaignService.list(req.user.brandId);
  }

  @Get(':id')
  get(@Param('id') id: string, @Req() req: AuthenticatedStaffRequest) {
    return this.depositCampaignService.get(req.user.brandId, id);
  }

  @Post()
  create(@Body() dto: CreateDepositCampaignDto, @Req() req: AuthenticatedStaffRequest) {
    const { startAt, endAt, ...rest } = dto;
    return this.depositCampaignService.create(
      req.user.brandId,
      { ...rest, startAt: startAt ? new Date(startAt) : null, endAt: endAt ? new Date(endAt) : null },
      { id: req.user.sub, username: req.user.username, brandId: req.user.brandId },
    );
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDepositCampaignDto, @Req() req: AuthenticatedStaffRequest) {
    const { startAt, endAt, ...rest } = dto;
    return this.depositCampaignService.update(
      req.user.brandId,
      id,
      {
        ...rest,
        ...(startAt !== undefined ? { startAt: startAt ? new Date(startAt) : null } : {}),
        ...(endAt !== undefined ? { endAt: endAt ? new Date(endAt) : null } : {}),
      },
      { id: req.user.sub, username: req.user.username, brandId: req.user.brandId },
    );
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
