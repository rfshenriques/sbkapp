import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../admin/roles.decorator';
import { RolesGuard } from '../admin/roles.guard';
import { StaffJwtAuthGuard } from '../admin/staff-jwt-auth.guard';
import type { StaffJwtPayload } from '../admin/staff-jwt.strategy';
import { SetCompetitionQuicklinkDto } from './dto/set-competition-quicklink.dto';
import { CompetitionQuicklinkService } from './competition-quicklink.service';

interface AuthenticatedStaffRequest {
  user: StaffJwtPayload;
}

@UseGuards(StaffJwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'CMS')
@Controller('admin/competition-quicklinks')
export class CompetitionQuicklinkController {
  constructor(private readonly competitionQuicklinkService: CompetitionQuicklinkService) {}

  @Get()
  list(@Req() req: AuthenticatedStaffRequest) {
    return this.competitionQuicklinkService.listQuicklinks(req.user.brandId);
  }

  @Post()
  set(@Body() dto: SetCompetitionQuicklinkDto, @Req() req: AuthenticatedStaffRequest) {
    return this.competitionQuicklinkService.setQuicklink(req.user.brandId, dto.competition, dto.order, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedStaffRequest) {
    return this.competitionQuicklinkService.removeQuicklink(req.user.brandId, id, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }
}
