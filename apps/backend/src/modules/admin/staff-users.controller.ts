import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AdminKeyGuard } from './admin-key.guard';
import { CreateStaffUserDto } from './dto/create-staff-user.dto';
import { StaffAuthService } from './staff-auth.service';

@UseGuards(AdminKeyGuard)
@Controller('admin/staff-users')
export class StaffUsersController {
  constructor(private readonly staffAuthService: StaffAuthService) {}

  @Post()
  createStaffUser(@Body() dto: CreateStaffUserDto) {
    return this.staffAuthService.createStaffUser(dto);
  }
}
