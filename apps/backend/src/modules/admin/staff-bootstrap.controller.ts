import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AdminKeyGuard } from './admin-key.guard';
import { BootstrapStaffUserDto } from './dto/bootstrap-staff-user.dto';
import { StaffAuthService } from './staff-auth.service';

/** One-time-per-brand bootstrap for a brand's first staff account - see StaffAuthService.bootstrapStaffUser. */
@UseGuards(AdminKeyGuard)
@Controller('admin/staff-users/bootstrap')
export class StaffBootstrapController {
  constructor(private readonly staffAuthService: StaffAuthService) {}

  @Post()
  bootstrapStaffUser(@Body() dto: BootstrapStaffUserDto) {
    return this.staffAuthService.bootstrapStaffUser(dto);
  }
}
