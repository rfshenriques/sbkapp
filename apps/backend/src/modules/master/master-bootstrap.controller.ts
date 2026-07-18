import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CreateMasterUserDto } from './dto/create-master-user.dto';
import { MasterAuthService } from './master-auth.service';
import { MasterKeyGuard } from './master-key.guard';

/** One-time bootstrap for the very first master user - see MasterAuthService.bootstrapMasterUser. */
@UseGuards(MasterKeyGuard)
@Controller('master/auth/bootstrap')
export class MasterBootstrapController {
  constructor(private readonly masterAuthService: MasterAuthService) {}

  @Post()
  bootstrapMasterUser(@Body() dto: CreateMasterUserDto) {
    return this.masterAuthService.bootstrapMasterUser(dto);
  }
}
