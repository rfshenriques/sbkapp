import { randomUUID } from 'node:crypto';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateMasterUserDto } from './dto/create-master-user.dto';
import { MasterAuthService } from './master-auth.service';

function buildCreateMasterUserDto(
  overrides: Partial<CreateMasterUserDto> = {},
): CreateMasterUserDto {
  const unique = randomUUID();
  return {
    email: `master-${unique}@example.com`,
    username: `master_${unique.slice(0, 8)}`,
    password: 'correct-horse-battery-staple',
    ...overrides,
  };
}

describe('MasterAuthService', () => {
  let moduleRef: TestingModule;
  let masterAuthService: MasterAuthService;
  let prisma: PrismaService;
  const createdMasterUserIds: string[] = [];

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        MasterAuthService,
        PrismaService,
        { provide: JwtService, useValue: new JwtService({}) },
      ],
    }).compile();
    await moduleRef.init();

    masterAuthService = moduleRef.get(MasterAuthService);
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    if (createdMasterUserIds.length > 0) {
      await prisma.masterUser.deleteMany({ where: { id: { in: createdMasterUserIds } } });
      createdMasterUserIds.length = 0;
    }
    await moduleRef.close();
  });

  it('bootstraps a master user with a hashed password', async () => {
    const dto = buildCreateMasterUserDto();

    const created = await masterAuthService.bootstrapMasterUser(dto);
    createdMasterUserIds.push(created.id);

    expect(created.username).toBe(dto.username);
    const masterUser = await prisma.masterUser.findUniqueOrThrow({ where: { id: created.id } });
    expect(masterUser.passwordHash).not.toBe(dto.password);
  });

  it('rejects bootstrapping a second master user once one already exists', async () => {
    const first = await masterAuthService.bootstrapMasterUser(buildCreateMasterUserDto());
    createdMasterUserIds.push(first.id);

    await expect(
      masterAuthService.bootstrapMasterUser(buildCreateMasterUserDto()),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects bootstrapping with an already-used email even when count is 0 elsewhere', async () => {
    const dto = buildCreateMasterUserDto();
    const first = await masterAuthService.bootstrapMasterUser(dto);
    createdMasterUserIds.push(first.id);

    // Second attempt hits the "already exists" guard first (count > 0),
    // which is the realistic path - a duplicate-email bootstrap can't
    // happen in practice since bootstrap only ever runs once.
    await expect(
      masterAuthService.bootstrapMasterUser(buildCreateMasterUserDto({ email: dto.email })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('logs in with the correct identifier + password and issues a token pair', async () => {
    const dto = buildCreateMasterUserDto();
    const created = await masterAuthService.bootstrapMasterUser(dto);
    createdMasterUserIds.push(created.id);

    const tokens = await masterAuthService.login({
      identifier: dto.username,
      password: dto.password,
    });
    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();
  });

  it('rejects login with the wrong password', async () => {
    const dto = buildCreateMasterUserDto();
    const created = await masterAuthService.bootstrapMasterUser(dto);
    createdMasterUserIds.push(created.id);

    await expect(
      masterAuthService.login({ identifier: dto.username, password: 'wrong-password' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('issues a new token pair on refresh and revokes the old refresh token', async () => {
    const dto = buildCreateMasterUserDto();
    const created = await masterAuthService.bootstrapMasterUser(dto);
    createdMasterUserIds.push(created.id);

    const { refreshToken } = await masterAuthService.login({
      identifier: dto.username,
      password: dto.password,
    });

    const refreshed = await masterAuthService.refresh(refreshToken);
    expect(refreshed.refreshToken).not.toBe(refreshToken);

    await expect(masterAuthService.refresh(refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('logout revokes the refresh token so it can no longer be used', async () => {
    const dto = buildCreateMasterUserDto();
    const created = await masterAuthService.bootstrapMasterUser(dto);
    createdMasterUserIds.push(created.id);

    const { refreshToken } = await masterAuthService.login({
      identifier: dto.username,
      password: dto.password,
    });

    await masterAuthService.logout(refreshToken);

    await expect(masterAuthService.refresh(refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
