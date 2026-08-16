import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AdminKeyGuard } from './admin-key.guard';
import { BootstrapStaffUserDto } from './dto/bootstrap-staff-user.dto';
import { StaffAuthService } from './staff-auth.service';

/**
 * One-time-per-brand bootstrap for a brand's first staff account - see
 * StaffAuthService.bootstrapStaffUser. Throttled since it's guarded by a
 * static shared secret (ADMIN_API_KEY) rather than per-user credentials -
 * without a rate limit that secret could be brute-forced.
 */
@UseGuards(AdminKeyGuard, ThrottlerGuard)
@Throttle({ default: { limit: 3, ttl: 60_000, blockDuration: 300_000 } })
@Controller('admin/staff-users/bootstrap')
export class StaffBootstrapController {
  constructor(private readonly staffAuthService: StaffAuthService) {}

  @Post()
  bootstrapStaffUser(@Body() dto: BootstrapStaffUserDto) {
    return this.staffAuthService.bootstrapStaffUser(dto);
  }
}
