import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt.strategy';
import { AcknowledgeCelebrationsDto } from './dto/acknowledge-celebrations.dto';
import { PlaceBetDto } from './dto/place-bet.dto';
import { PamService } from './pam.service';

interface AuthenticatedRequest {
  user: JwtPayload;
}

@UseGuards(JwtAuthGuard)
@Controller()
export class PamController {
  constructor(private readonly pamService: PamService) {}

  @Get('wallet')
  getWallet(@Req() req: AuthenticatedRequest) {
    return this.pamService.getWallet(req.user.sub);
  }

  @Post('bets')
  placeBet(@Req() req: AuthenticatedRequest, @Body() dto: PlaceBetDto) {
    return this.pamService.placeBet(req.user.sub, dto);
  }

  @Get('bets')
  getBets(@Req() req: AuthenticatedRequest) {
    return this.pamService.getBets(req.user.sub);
  }

  @Get('freebets')
  getFreebets(@Req() req: AuthenticatedRequest) {
    return this.pamService.getFreebets(req.user.sub);
  }

  @Get('unseen-celebrations')
  getUnseenCelebrations(@Req() req: AuthenticatedRequest) {
    return this.pamService.getUnseenCelebrations(req.user.sub);
  }

  @Post('unseen-celebrations/ack')
  acknowledgeCelebrations(@Req() req: AuthenticatedRequest, @Body() dto: AcknowledgeCelebrationsDto) {
    return this.pamService.acknowledgeCelebrations(req.user.sub, dto.betIds, dto.freebetGrantIds);
  }
}
