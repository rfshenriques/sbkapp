import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CreateMasterUserDto } from './dto/create-master-user.dto';
import { MasterAuthService } from './master-auth.service';
import { MasterKeyGuard } from './master-key.guard';

/**
 * One-time bootstrap for the very first master user - see
 * MasterAuthService.bootstrapMasterUser. Throttled since it's guarded by a
 * static shared secret (MASTER_ADMIN_KEY) rather than per-user credentials -
 * without a rate limit that secret could be brute-forced.
 */
@UseGuards(MasterKeyGuard, ThrottlerGuard)
@Throttle({ default: { limit: 3, ttl: 60_000, blockDuration: 300_000 } })
@Controller('master/auth/bootstrap')
export class MasterBootstrapController {
  constructor(private readonly masterAuthService: MasterAuthService) {}

  @Post()
  bootstrapMasterUser(@Body() dto: CreateMasterUserDto) {
    return this.masterAuthService.bootstrapMasterUser(dto);
  }
}
