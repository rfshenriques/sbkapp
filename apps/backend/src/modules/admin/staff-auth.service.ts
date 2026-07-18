import { createHash, randomBytes } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { StaffRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, type AuditActor } from './audit-log.service';
import type { BootstrapStaffUserDto } from './dto/bootstrap-staff-user.dto';
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
   * `actor` is the authenticated ADMIN creating this account - their own
   * brandId is always used, an ADMIN can never create a staff account in
   * a brand other than their own. `actor` is undefined only when called
   * from the one-time bootstrap path (no staff user is authenticated yet
   * - see bootstrapStaffUser), where brandId comes from the bootstrap
   * request instead.
   */
  async createStaffUser(dto: CreateStaffUserDto, brandId: string, actor?: AuditActor) {
    const existing = await this.prisma.staffUser.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    });
    if (existing) {
      throw new ConflictException('Email or username already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    const staffUser = await this.prisma.staffUser.create({
      data: { email: dto.email, username: dto.username, passwordHash, role: dto.role, brandId },
    });

    await this.auditLogService.record({
      actor: actor ?? { id: null, username: 'SYSTEM_BOOTSTRAP', brandId },
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
      brandId: staffUser.brandId,
    };
  }

  /** Only usable while no staff users exist yet for this brand - the AdminKeyGuard's sole remaining purpose. */
  async bootstrapStaffUser(dto: BootstrapStaffUserDto) {
    const brand = await this.prisma.brand.findUnique({ where: { id: dto.brandId } });
    if (!brand) {
      throw new NotFoundException('Unknown brand');
    }

    const staffUserCount = await this.prisma.staffUser.count({ where: { brandId: dto.brandId } });
    if (staffUserCount > 0) {
      throw new ForbiddenException(
        'Staff users already exist for this brand - log in as an ADMIN and use staff-user management instead',
      );
    }
    return this.createStaffUser(dto, dto.brandId);
  }

  async listStaffUsers(brandId: string) {
    return this.prisma.staffUser.findMany({
      where: { brandId },
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

    return this.issueTokens(staffUser.id, staffUser.username, staffUser.role, staffUser.brandId);
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

    return this.issueTokens(
      stored.staffUser.id,
      stored.staffUser.username,
      stored.staffUser.role,
      stored.staffUser.brandId,
    );
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
    brandId: string,
  ): Promise<StaffAuthTokens> {
    const accessToken = await this.jwtService.signAsync(
      { sub: staffUserId, username, role, brandId },
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
