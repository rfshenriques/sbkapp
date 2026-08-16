import { Controller, Get, NotFoundException, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../admin/roles.decorator';
import { RolesGuard } from '../admin/roles.guard';
import { StaffJwtAuthGuard } from '../admin/staff-jwt-auth.guard';
import type { StaffJwtPayload } from '../admin/staff-jwt.strategy';
import { SearchPlayersQueryDto } from './dto/search-players-query.dto';
import { PlayerLookupService } from './player-lookup.service';

interface AuthenticatedStaffRequest {
  user: StaffJwtPayload;
}

@UseGuards(StaffJwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'CRM')
@Controller('admin/players')
export class PlayersAdminController {
  constructor(private readonly playerLookupService: PlayerLookupService) {}

  @Get()
  search(@Query() query: SearchPlayersQueryDto, @Req() req: AuthenticatedStaffRequest) {
    return this.playerLookupService.search(req.user.brandId, query.query);
  }

  @Get(':id')
  async detail(@Param('id') id: string, @Req() req: AuthenticatedStaffRequest) {
    const player = await this.playerLookupService.getDetail(req.user.brandId, id);
    if (!player) {
      throw new NotFoundException('Player not found');
    }
    return player;
  }
}
