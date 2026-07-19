import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../admin/roles.decorator';
import { RolesGuard } from '../admin/roles.guard';
import { StaffJwtAuthGuard } from '../admin/staff-jwt-auth.guard';
import type { StaffJwtPayload } from '../admin/staff-jwt.strategy';
import { SetTeamColorDto } from './dto/set-team-color.dto';
import { SyncTeamNamesDto } from './dto/sync-team-names.dto';
import { TeamColorsService } from './team-colors.service';

interface AuthenticatedStaffRequest {
  user: StaffJwtPayload;
}

/**
 * Not brand-scoped (see TeamColor's schema comment) - but still gated behind
 * staff auth, since any staff account editing a shared team's color affects
 * every brand at once.
 */
@UseGuards(StaffJwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'CMS')
@Controller('admin/team-colors')
export class TeamColorsController {
  constructor(private readonly teamColorsService: TeamColorsService) {}

  @Get()
  list() {
    return this.teamColorsService.list();
  }

  @Post('sync')
  sync(@Body() dto: SyncTeamNamesDto) {
    return this.teamColorsService.syncNames(dto.names);
  }

  @Patch(':id')
  setColor(@Param('id') id: string, @Body() dto: SetTeamColorDto, @Req() req: AuthenticatedStaffRequest) {
    if (dto.colorHex === undefined) {
      throw new BadRequestException('colorHex is required');
    }

    return this.teamColorsService.setColor(id, dto.colorHex, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }
}
