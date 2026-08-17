import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../admin/roles.decorator';
import { RolesGuard } from '../admin/roles.guard';
import { StaffJwtAuthGuard } from '../admin/staff-jwt-auth.guard';
import type { StaffJwtPayload } from '../admin/staff-jwt.strategy';
import { CreateMatchOfTheDayDto } from './dto/create-match-of-the-day.dto';
import { ReorderMatchOfTheDayDto } from './dto/reorder-match-of-the-day.dto';
import { UpdateMatchOfTheDayDto } from './dto/update-match-of-the-day.dto';
import { MatchOfTheDayService } from './match-of-the-day.service';

interface AuthenticatedStaffRequest {
  user: StaffJwtPayload;
}

@UseGuards(StaffJwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'CMS')
@Controller('admin/match-of-the-day')
export class MatchOfTheDayAdminController {
  constructor(private readonly matchOfTheDayService: MatchOfTheDayService) {}

  @Get()
  list(@Req() req: AuthenticatedStaffRequest) {
    return this.matchOfTheDayService.list(req.user.brandId);
  }

  @Post()
  add(@Body() dto: CreateMatchOfTheDayDto, @Req() req: AuthenticatedStaffRequest) {
    return this.matchOfTheDayService.add(
      req.user.brandId,
      {
        matchId: dto.matchId,
        enabled: dto.enabled,
        startAt: dto.startAt ? new Date(dto.startAt) : null,
        endAt: dto.endAt ? new Date(dto.endAt) : null,
      },
      { id: req.user.sub, username: req.user.username, brandId: req.user.brandId },
    );
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMatchOfTheDayDto, @Req() req: AuthenticatedStaffRequest) {
    const { startAt, endAt, ...rest } = dto;
    return this.matchOfTheDayService.update(
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

  @Post('reorder')
  reorder(@Body() dto: ReorderMatchOfTheDayDto, @Req() req: AuthenticatedStaffRequest) {
    return this.matchOfTheDayService.reorder(req.user.brandId, dto.ids, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedStaffRequest) {
    return this.matchOfTheDayService.remove(req.user.brandId, id, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }
}
