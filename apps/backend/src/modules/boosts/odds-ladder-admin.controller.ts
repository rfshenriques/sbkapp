import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../admin/roles.decorator';
import { RolesGuard } from '../admin/roles.guard';
import { StaffJwtAuthGuard } from '../admin/staff-jwt-auth.guard';
import type { StaffJwtPayload } from '../admin/staff-jwt.strategy';
import { AddOddsLadderRungDto } from './dto/add-odds-ladder-rung.dto';
import { OddsLadderService } from './odds-ladder.service';

interface AuthenticatedStaffRequest {
  user: StaffJwtPayload;
}

@UseGuards(StaffJwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'TRADING')
@Controller('admin/odds-ladder')
export class OddsLadderAdminController {
  constructor(private readonly oddsLadderService: OddsLadderService) {}

  @Get()
  list(@Req() req: AuthenticatedStaffRequest) {
    return this.oddsLadderService.listRungs(req.user.brandId);
  }

  @Post()
  addRung(@Body() dto: AddOddsLadderRungDto, @Req() req: AuthenticatedStaffRequest) {
    return this.oddsLadderService.addRung(req.user.brandId, dto.value, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }

  @Post('generate-standard')
  generateStandard(@Req() req: AuthenticatedStaffRequest) {
    return this.oddsLadderService.regenerateStandard(req.user.brandId, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }

  @Delete(':id')
  removeRung(@Param('id') id: string, @Req() req: AuthenticatedStaffRequest) {
    return this.oddsLadderService.removeRung(req.user.brandId, id, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }
}
