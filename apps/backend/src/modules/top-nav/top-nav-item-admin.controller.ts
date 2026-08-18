import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../admin/roles.decorator';
import { RolesGuard } from '../admin/roles.guard';
import { StaffJwtAuthGuard } from '../admin/staff-jwt-auth.guard';
import type { StaffJwtPayload } from '../admin/staff-jwt.strategy';
import { CreateTopNavItemDto } from './dto/create-top-nav-item.dto';
import { ReorderTopNavItemsDto } from './dto/reorder-top-nav-items.dto';
import { UpdateTopNavItemDto } from './dto/update-top-nav-item.dto';
import { TopNavItemService } from './top-nav-item.service';

interface AuthenticatedStaffRequest {
  user: StaffJwtPayload;
}

@UseGuards(StaffJwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'CMS')
@Controller('admin/top-nav')
export class TopNavItemAdminController {
  constructor(private readonly topNavItemService: TopNavItemService) {}

  @Get()
  list(@Req() req: AuthenticatedStaffRequest) {
    return this.topNavItemService.list(req.user.brandId);
  }

  @Post()
  add(@Body() dto: CreateTopNavItemDto, @Req() req: AuthenticatedStaffRequest) {
    return this.topNavItemService.add(
      req.user.brandId,
      dto,
      { id: req.user.sub, username: req.user.username, brandId: req.user.brandId },
    );
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTopNavItemDto, @Req() req: AuthenticatedStaffRequest) {
    return this.topNavItemService.update(req.user.brandId, id, dto, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }

  @Post('reorder')
  reorder(@Body() dto: ReorderTopNavItemsDto, @Req() req: AuthenticatedStaffRequest) {
    return this.topNavItemService.reorder(req.user.brandId, dto.ids, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedStaffRequest) {
    return this.topNavItemService.remove(req.user.brandId, id, {
      id: req.user.sub,
      username: req.user.username,
      brandId: req.user.brandId,
    });
  }
}
