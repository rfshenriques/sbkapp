import { createHash, randomBytes } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const BCRYPT_SALT_ROUNDS = 12;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokens> {
    const brand = await this.prisma.brand.findUnique({ where: { id: dto.brandId } });
    if (!brand) {
      throw new NotFoundException('Unknown brand');
    }

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }, { phone: dto.phone }] },
    });
    if (existing) {
      throw new ConflictException('Email, username, or phone number already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        phone: dto.phone,
        passwordHash,
        brandId: dto.brandId,
        referrerUrl: dto.referrerUrl,
        utmSource: dto.utmSource,
        utmMedium: dto.utmMedium,
        utmCampaign: dto.utmCampaign,
      },
    });

    return this.issueTokens(user.id, user.username, user.email, user.brandId);
  }

  async login(dto: LoginDto): Promise<AuthTokens> {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.identifier }, { username: dto.identifier }] },
    });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Only one device stays signed in at a time - logging in here revokes
    // every other still-active refresh token for this player, so an
    // already-open session elsewhere can no longer silently refresh once
    // its short-lived access token expires (see authenticatedFetch on the
    // frontend, which clears local auth state the moment a refresh fails).
    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(user.id, user.username, user.email, user.brandId);
  }

  /**
   * The tail end of login() (revoke-other-devices, then issue) minus the
   * password check - used by WebAuthnService once a passkey assertion has
   * already verified who the player is, so the same single-active-session
   * invariant applies to a biometric login as a password one.
   */
  async loginWithUserId(userId: string): Promise<AuthTokens> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(user.id, user.username, user.email, user.brandId);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(
      stored.user.id,
      stored.user.username,
      stored.user.email,
      stored.user.brandId,
    );
  }

  async logout(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(
    userId: string,
    username: string,
    email: string,
    brandId: string,
  ): Promise<AuthTokens> {
    const accessToken = await this.jwtService.signAsync(
      { sub: userId, username, email, brandId },
      { expiresIn: ACCESS_TOKEN_TTL },
    );

    const refreshToken = randomBytes(48).toString('hex');
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    return { accessToken, refreshToken };
  }
}
