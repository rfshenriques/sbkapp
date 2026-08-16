import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { MasterLoginDto } from './dto/master-login.dto';
import { MasterAuthService } from './master-auth.service';
import { MasterJwtAuthGuard } from './master-jwt-auth.guard';
import type { MasterJwtPayload } from './master-jwt.strategy';

interface AuthenticatedMasterRequest {
  user: MasterJwtPayload;
}

const REFRESH_COOKIE_NAME = 'masterRefreshToken';
const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** Distinct cookie name so a master session can coexist with a staff or player session in the same browser without colliding. */
function refreshCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    path: '/',
  };
}

@Controller('master/auth')
export class MasterAuthController {
  constructor(private readonly masterAuthService: MasterAuthService) {}

  // 5 attempts/min per IP, then blocked for 5 more minutes - slows down
  // credential stuffing without needing a CAPTCHA for normal logins.
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000, blockDuration: 300_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: MasterLoginDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken } = await this.masterAuthService.login(dto);
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
    return { accessToken };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const currentRefreshToken: unknown = req.cookies?.[REFRESH_COOKIE_NAME];
    if (typeof currentRefreshToken !== 'string') {
      throw new UnauthorizedException('No refresh token');
    }

    const { accessToken, refreshToken } = await this.masterAuthService.refresh(currentRefreshToken);
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
    return { accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const currentRefreshToken: unknown = req.cookies?.[REFRESH_COOKIE_NAME];
    if (typeof currentRefreshToken === 'string') {
      await this.masterAuthService.logout(currentRefreshToken);
    }
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
  }

  @UseGuards(MasterJwtAuthGuard)
  @Get('me')
  me(@Req() req: AuthenticatedMasterRequest): MasterJwtPayload {
    return req.user;
  }
}
