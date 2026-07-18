import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AdminKeyGuard } from './admin-key.guard';
import { CreateStaffUserDto } from './dto/create-staff-user.dto';
import { StaffAuthService } from './staff-auth.service';

/** One-time bootstrap for the very first staff account - see StaffAuthService.bootstrapStaffUser. */
@UseGuards(AdminKeyGuard)
@Controller('admin/staff-users/bootstrap')
export class StaffBootstrapController {
  constructor(private readonly staffAuthService: StaffAuthService) {}

  @Post()
  bootstrapStaffUser(@Body() dto: CreateStaffUserDto) {
    return this.staffAuthService.bootstrapStaffUser(dto);
  }
}
