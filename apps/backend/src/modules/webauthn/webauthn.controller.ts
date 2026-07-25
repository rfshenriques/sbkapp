import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeDomain } from '../master/normalize-domain';
import { resolveRpContext } from './rp-context';
import { WebAuthnService } from './webauthn.service';

interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function refreshCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    path: '/',
  };
}

@Controller('auth/webauthn')
export class WebAuthnController {
  constructor(
    private readonly webAuthnService: WebAuthnService,
    private readonly prisma: PrismaService,
  ) {}

  private async resolveRpName(rpId: string): Promise<string> {
    const brand = await this.prisma.brand.findFirst({ where: { domain: normalizeDomain(rpId) } });
    return brand?.name ?? 'Sportsbook';
  }

  @UseGuards(JwtAuthGuard)
  @Post('register/options')
  async registerOptions(@Req() req: AuthenticatedRequest) {
    const { rpId } = resolveRpContext(req);
    const rpName = await this.resolveRpName(rpId);
    return this.webAuthnService.generateRegistrationOptionsForUser(req.user.sub, rpId, rpName);
  }

  @UseGuards(JwtAuthGuard)
  @Post('register/verify')
  async registerVerify(
    @Req() req: AuthenticatedRequest,
    @Body() response: RegistrationResponseJSON,
    @Query('nickname') nickname?: string,
  ) {
    const { rpId, origin } = resolveRpContext(req);
    const credential = await this.webAuthnService.verifyRegistration(req.user.sub, response, rpId, origin);
    if (nickname) {
      await this.prisma.webAuthnCredential.update({ where: { id: credential.id }, data: { nickname } });
      return { ...credential, nickname };
    }
    return credential;
  }

  @Post('login/options')
  @HttpCode(HttpStatus.OK)
  async loginOptions(@Req() req: Request) {
    const { rpId } = resolveRpContext(req);
    return this.webAuthnService.generateLoginOptions(rpId);
  }

  @Post('login/verify')
  @HttpCode(HttpStatus.OK)
  async loginVerify(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() response: AuthenticationResponseJSON,
  ) {
    const { rpId, origin } = resolveRpContext(req);
    const { accessToken, refreshToken } = await this.webAuthnService.verifyLogin(response, rpId, origin);
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
    return { accessToken };
  }

  @UseGuards(JwtAuthGuard)
  @Get('credentials')
  async listCredentials(@Req() req: AuthenticatedRequest) {
    return this.webAuthnService.listCredentials(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('credentials/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeCredential(@Req() req: AuthenticatedRequest, @Param('id') id: string): Promise<void> {
    await this.webAuthnService.removeCredential(req.user.sub, id);
  }
}
