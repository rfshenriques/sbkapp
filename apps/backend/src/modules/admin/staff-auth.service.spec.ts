import { randomUUID } from 'node:crypto';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
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
        { provide: JwtService, useValue: new JwtService({}) },
      ],
    }).compile();
    await moduleRef.init();

    staffAuthService = moduleRef.get(StaffAuthService);
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    if (createdStaffUserIds.length > 0) {
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
});
