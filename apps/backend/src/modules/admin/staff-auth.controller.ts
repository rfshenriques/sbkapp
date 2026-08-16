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
import { StaffLoginDto } from './dto/staff-login.dto';
import { StaffAuthService } from './staff-auth.service';
import { StaffJwtAuthGuard } from './staff-jwt-auth.guard';
import type { StaffJwtPayload } from './staff-jwt.strategy';

interface AuthenticatedStaffRequest {
  user: StaffJwtPayload;
}

const REFRESH_COOKIE_NAME = 'staffRefreshToken';
const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** Same reasoning as the player auth cookie (apps/backend/src/modules/auth/auth.controller.ts) - a distinct cookie name so a staff and player session can coexist in the same browser without colliding. */
function refreshCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    path: '/',
  };
}

@Controller('admin/staff-auth')
export class StaffAuthController {
  constructor(private readonly staffAuthService: StaffAuthService) {}

  // 5 attempts/min per IP, then blocked for 5 more minutes - slows down
  // credential stuffing without needing a CAPTCHA for normal logins.
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000, blockDuration: 300_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: StaffLoginDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken } = await this.staffAuthService.login(dto);
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

    const { accessToken, refreshToken } = await this.staffAuthService.refresh(currentRefreshToken);
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
    return { accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const currentRefreshToken: unknown = req.cookies?.[REFRESH_COOKIE_NAME];
    if (typeof currentRefreshToken === 'string') {
      await this.staffAuthService.logout(currentRefreshToken);
    }
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
  }

  @UseGuards(StaffJwtAuthGuard)
  @Get('me')
  me(@Req() req: AuthenticatedStaffRequest): StaffJwtPayload {
    return req.user;
  }
}
