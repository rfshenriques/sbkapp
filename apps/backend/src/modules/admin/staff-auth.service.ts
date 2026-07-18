import { createHash, randomBytes } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { StaffRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from './audit-log.service';
import type { CreateStaffUserDto } from './dto/create-staff-user.dto';
import type { StaffLoginDto } from './dto/staff-login.dto';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const BCRYPT_SALT_ROUNDS = 12;

export interface StaffAuthTokens {
  accessToken: string;
  refreshToken: string;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class StaffAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * `actor` is the authenticated ADMIN creating this account, or undefined
   * when called from the one-time bootstrap path (no staff user is
   * authenticated yet - see bootstrapStaffUser).
   */
  async createStaffUser(dto: CreateStaffUserDto, actor?: AuditActor) {
    const existing = await this.prisma.staffUser.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    });
    if (existing) {
      throw new ConflictException('Email or username already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    const staffUser = await this.prisma.staffUser.create({
      data: { email: dto.email, username: dto.username, passwordHash, role: dto.role },
    });

    await this.auditLogService.record({
      actor: actor ?? { id: null, username: 'SYSTEM_BOOTSTRAP' },
      action: actor ? 'STAFF_USER_CREATED' : 'STAFF_USER_BOOTSTRAPPED',
      targetType: 'StaffUser',
      targetId: staffUser.id,
      metadata: { username: staffUser.username, email: staffUser.email, role: staffUser.role },
    });

    return {
      id: staffUser.id,
      email: staffUser.email,
      username: staffUser.username,
      role: staffUser.role,
    };
  }

  /** Only usable while no staff users exist yet - the AdminKeyGuard's sole remaining purpose. */
  async bootstrapStaffUser(dto: CreateStaffUserDto) {
    const staffUserCount = await this.prisma.staffUser.count();
    if (staffUserCount > 0) {
      throw new ForbiddenException(
        'Staff users already exist - log in as an ADMIN and use staff-user management instead',
      );
    }
    return this.createStaffUser(dto);
  }

  async listStaffUsers() {
    return this.prisma.staffUser.findMany({
      select: { id: true, email: true, username: true, role: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async login(dto: StaffLoginDto): Promise<StaffAuthTokens> {
    const staffUser = await this.prisma.staffUser.findFirst({
      where: { OR: [{ email: dto.identifier }, { username: dto.identifier }] },
    });
    if (!staffUser || !(await bcrypt.compare(dto.password, staffUser.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueTokens(staffUser.id, staffUser.username, staffUser.role);
  }

  async refresh(refreshToken: string): Promise<StaffAuthTokens> {
    const stored = await this.prisma.staffRefreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { staffUser: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.prisma.staffRefreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(stored.staffUser.id, stored.staffUser.username, stored.staffUser.role);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.prisma.staffRefreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(
    staffUserId: string,
    username: string,
    role: StaffRole,
  ): Promise<StaffAuthTokens> {
    const accessToken = await this.jwtService.signAsync(
      { sub: staffUserId, username, role },
      { secret: process.env.STAFF_JWT_SECRET, expiresIn: ACCESS_TOKEN_TTL },
    );

    const refreshToken = randomBytes(48).toString('hex');
    await this.prisma.staffRefreshToken.create({
      data: {
        staffUserId,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    return { accessToken, refreshToken };
  }
}
