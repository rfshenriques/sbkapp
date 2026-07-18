import { randomUUID } from 'node:crypto';
import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from './audit-log.service';
import type { CreateStaffUserDto } from './dto/create-staff-user.dto';
import { StaffAuthService } from './staff-auth.service';

function buildCreateStaffUserDto(overrides: Partial<CreateStaffUserDto> = {}): CreateStaffUserDto {
  const unique = randomUUID();
  return {
    email: `staff-${unique}@example.com`,
    username: `staff_${unique.slice(0, 8)}`,
    password: 'correct-horse-battery-staple',
    role: 'TRADING',
    ...overrides,
  };
}

describe('StaffAuthService', () => {
  let moduleRef: TestingModule;
  let staffAuthService: StaffAuthService;
  let prisma: PrismaService;
  const createdStaffUserIds: string[] = [];

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        StaffAuthService,
        PrismaService,
        AuditLogService,
        { provide: JwtService, useValue: new JwtService({}) },
      ],
    }).compile();
    await moduleRef.init();

    staffAuthService = moduleRef.get(StaffAuthService);
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    if (createdStaffUserIds.length > 0) {
      await prisma.auditLogEntry.deleteMany({
        where: { targetType: 'StaffUser', targetId: { in: createdStaffUserIds } },
      });
      await prisma.staffUser.deleteMany({ where: { id: { in: createdStaffUserIds } } });
      createdStaffUserIds.length = 0;
    }
    await moduleRef.close();
  });

  it('creates a staff user with a hashed password and the given role', async () => {
    const dto = buildCreateStaffUserDto({ role: 'RISK' });

    const created = await staffAuthService.createStaffUser(dto);
    createdStaffUserIds.push(created.id);

    expect(created.role).toBe('RISK');
    const staffUser = await prisma.staffUser.findUniqueOrThrow({ where: { id: created.id } });
    expect(staffUser.passwordHash).not.toBe(dto.password);
  });

  it('rejects creating a staff user with an already-used email', async () => {
    const dto = buildCreateStaffUserDto();
    const first = await staffAuthService.createStaffUser(dto);
    createdStaffUserIds.push(first.id);

    await expect(
      staffAuthService.createStaffUser(buildCreateStaffUserDto({ email: dto.email })),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('logs in with the correct identifier + password and issues a token pair', async () => {
    const dto = buildCreateStaffUserDto();
    const created = await staffAuthService.createStaffUser(dto);
    createdStaffUserIds.push(created.id);

    const tokens = await staffAuthService.login({
      identifier: dto.username,
      password: dto.password,
    });
    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();
  });

  it('rejects login with the wrong password', async () => {
    const dto = buildCreateStaffUserDto();
    const created = await staffAuthService.createStaffUser(dto);
    createdStaffUserIds.push(created.id);

    await expect(
      staffAuthService.login({ identifier: dto.username, password: 'wrong-password' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('issues a new token pair on refresh and revokes the old refresh token', async () => {
    const dto = buildCreateStaffUserDto();
    const created = await staffAuthService.createStaffUser(dto);
    createdStaffUserIds.push(created.id);

    const { refreshToken } = await staffAuthService.login({
      identifier: dto.username,
      password: dto.password,
    });

    const refreshed = await staffAuthService.refresh(refreshToken);
    expect(refreshed.refreshToken).not.toBe(refreshToken);

    await expect(staffAuthService.refresh(refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('logout revokes the refresh token so it can no longer be used', async () => {
    const dto = buildCreateStaffUserDto();
    const created = await staffAuthService.createStaffUser(dto);
    createdStaffUserIds.push(created.id);

    const { refreshToken } = await staffAuthService.login({
      identifier: dto.username,
      password: dto.password,
    });

    await staffAuthService.logout(refreshToken);

    await expect(staffAuthService.refresh(refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects bootstrapping a staff user once any staff user already exists', async () => {
    const existing = await staffAuthService.createStaffUser(buildCreateStaffUserDto());
    createdStaffUserIds.push(existing.id);

    await expect(
      staffAuthService.bootstrapStaffUser(buildCreateStaffUserDto()),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lists staff users without exposing their password hash', async () => {
    const dto = buildCreateStaffUserDto({ role: 'CRM' });
    const created = await staffAuthService.createStaffUser(dto);
    createdStaffUserIds.push(created.id);

    const listed = await staffAuthService.listStaffUsers();
    const found = listed.find((staffUser) => staffUser.id === created.id);

    expect(found).toMatchObject({ username: dto.username, email: dto.email, role: 'CRM' });
    expect(found).not.toHaveProperty('passwordHash');
  });

  it('records an audit entry attributed to the creating ADMIN when created by an authenticated actor', async () => {
    const dto = buildCreateStaffUserDto();
    const actor = { id: 'admin-staff-id', username: 'admin_amy' };
    const created = await staffAuthService.createStaffUser(dto, actor);
    createdStaffUserIds.push(created.id);

    const entry = await prisma.auditLogEntry.findFirstOrThrow({
      where: { targetType: 'StaffUser', targetId: created.id },
    });
    expect(entry.action).toBe('STAFF_USER_CREATED');
    expect(entry.actorStaffUserId).toBe(actor.id);
    expect(entry.actorUsername).toBe(actor.username);
  });

  it('records an audit entry attributed to the system when created via bootstrap', async () => {
    // No prior staff users exist in this isolated test module instance.
    const dto = buildCreateStaffUserDto();
    const created = await staffAuthService.bootstrapStaffUser(dto);
    createdStaffUserIds.push(created.id);

    const entry = await prisma.auditLogEntry.findFirstOrThrow({
      where: { targetType: 'StaffUser', targetId: created.id },
    });
    expect(entry.action).toBe('STAFF_USER_BOOTSTRAPPED');
    expect(entry.actorStaffUserId).toBeNull();
    expect(entry.actorUsername).toBe('SYSTEM_BOOTSTRAP');
  });
});
