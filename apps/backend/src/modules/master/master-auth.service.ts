import { createHash, randomBytes } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateMasterUserDto } from './dto/create-master-user.dto';
import type { MasterLoginDto } from './dto/master-login.dto';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const BCRYPT_SALT_ROUNDS = 12;

export interface MasterAuthTokens {
  accessToken: string;
  refreshToken: string;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class MasterAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /** Only usable while no master users exist yet - the MasterKeyGuard's sole purpose. */
  async bootstrapMasterUser(dto: CreateMasterUserDto) {
    const masterUserCount = await this.prisma.masterUser.count();
    if (masterUserCount > 0) {
      throw new ForbiddenException('A master user already exists - log in instead');
    }

    const existing = await this.prisma.masterUser.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    });
    if (existing) {
      throw new ConflictException('Email or username already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    const masterUser = await this.prisma.masterUser.create({
      data: { email: dto.email, username: dto.username, passwordHash },
    });

    return { id: masterUser.id, email: masterUser.email, username: masterUser.username };
  }

  async login(dto: MasterLoginDto): Promise<MasterAuthTokens> {
    const masterUser = await this.prisma.masterUser.findFirst({
      where: { OR: [{ email: dto.identifier }, { username: dto.identifier }] },
    });
    if (!masterUser || !(await bcrypt.compare(dto.password, masterUser.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueTokens(masterUser.id, masterUser.username);
  }

  async refresh(refreshToken: string): Promise<MasterAuthTokens> {
    const stored = await this.prisma.masterRefreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { masterUser: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.prisma.masterRefreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(stored.masterUser.id, stored.masterUser.username);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.prisma.masterRefreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(masterUserId: string, username: string): Promise<MasterAuthTokens> {
    const accessToken = await this.jwtService.signAsync(
      { sub: masterUserId, username },
      { secret: process.env.MASTER_JWT_SECRET, expiresIn: ACCESS_TOKEN_TTL },
    );

    const refreshToken = randomBytes(48).toString('hex');
    await this.prisma.masterRefreshToken.create({
      data: {
        masterUserId,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    return { accessToken, refreshToken };
  }
}
