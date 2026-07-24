import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../admin/roles.decorator';
import { RolesGuard } from '../admin/roles.guard';
import { StaffJwtAuthGuard } from '../admin/staff-jwt-auth.guard';
import type { StaffJwtPayload } from '../admin/staff-jwt.strategy';
import { AddSegmentMemberDto } from './dto/add-segment-member.dto';
import { CreatePlayerSegmentDto } from './dto/create-player-segment.dto';
import { SetPlayerSegmentColorDto } from './dto/set-player-segment-color.dto';
import { PlayerSegmentService } from './player-segment.service';

interface AuthenticatedStaffRequest {
  user: StaffJwtPayload;
}

@UseGuards(StaffJwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'CRM')
@Controller('admin/player-segments')
export class PlayerSegmentController {
  constructor(private readonly playerSegmentService: PlayerSegmentService) {}

  @Get()
  list(@Req() req: AuthenticatedStaffRequest) {
    return this.playerSegmentService.listSegments(req.user.brandId);
  }

  @Post()
  create(@Body() dto: CreatePlayerSegmentDto, @Req() req: AuthenticatedStaffRequest) {
    return this.playerSegmentService.createSegment(req.user.brandId, dto.name, dto.description, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }

  @Patch(':id/color')
  setColor(
    @Param('id') id: string,
    @Body() dto: SetPlayerSegmentColorDto,
    @Req() req: AuthenticatedStaffRequest,
  ) {
    if (dto.colorHex === undefined) {
      throw new BadRequestException('colorHex is required');
    }

    return this.playerSegmentService.setColor(req.user.brandId, id, dto.colorHex, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedStaffRequest) {
    return this.playerSegmentService.removeSegment(req.user.brandId, id, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }

  @Post(':id/members')
  addMember(
    @Param('id') id: string,
    @Body() dto: AddSegmentMemberDto,
    @Req() req: AuthenticatedStaffRequest,
  ) {
    return this.playerSegmentService.addMember(req.user.brandId, id, dto.identifier, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }

  @Delete(':id/members/:userId')
  removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Req() req: AuthenticatedStaffRequest,
  ) {
    return this.playerSegmentService.removeMember(req.user.brandId, id, userId, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }
}
