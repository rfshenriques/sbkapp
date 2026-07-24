import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../admin/roles.decorator';
import { RolesGuard } from '../admin/roles.guard';
import { StaffJwtAuthGuard } from '../admin/staff-jwt-auth.guard';
import type { StaffJwtPayload } from '../admin/staff-jwt.strategy';
import { GrantFreebetDto } from './dto/grant-freebet.dto';
import { FreebetService } from './freebet.service';

interface AuthenticatedStaffRequest {
  user: StaffJwtPayload;
}

@UseGuards(StaffJwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'CRM')
@Controller('admin/freebets')
export class FreebetController {
  constructor(private readonly freebetService: FreebetService) {}

  @Get(':identifier')
  list(@Param('identifier') identifier: string, @Req() req: AuthenticatedStaffRequest) {
    return this.freebetService.list(req.user.brandId, identifier);
  }

  @Post()
  grant(@Body() dto: GrantFreebetDto, @Req() req: AuthenticatedStaffRequest) {
    return this.freebetService.grant(
      req.user.brandId,
      { ...dto, expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined },
      { id: req.user.sub, username: req.user.username, brandId: req.user.brandId },
    );
  }

  @Delete(':id')
  void(@Param('id') id: string, @Req() req: AuthenticatedStaffRequest) {
    return this.freebetService.void(req.user.brandId, id, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }
}
