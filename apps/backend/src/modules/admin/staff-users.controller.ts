import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { CreateStaffUserDto } from './dto/create-staff-user.dto';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';
import { StaffAuthService } from './staff-auth.service';
import { StaffJwtAuthGuard } from './staff-jwt-auth.guard';
import type { StaffJwtPayload } from './staff-jwt.strategy';

interface AuthenticatedStaffRequest {
  user: StaffJwtPayload;
}

@UseGuards(StaffJwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/staff-users')
export class StaffUsersController {
  constructor(private readonly staffAuthService: StaffAuthService) {}

  @Get()
  listStaffUsers() {
    return this.staffAuthService.listStaffUsers();
  }

  @Post()
  createStaffUser(@Body() dto: CreateStaffUserDto, @Req() req: AuthenticatedStaffRequest) {
    return this.staffAuthService.createStaffUser(dto, {
      id: req.user.sub,
      username: req.user.username,
    });
  }
}
