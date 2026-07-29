import { randomUUID } from 'node:crypto';
import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../admin/audit-log.service';
import { FreebetService } from '../freebets/freebet.service';
import { RegisterCampaignService } from '../register-campaigns/register-campaign.service';
import { AuthService } from './auth.service';
import type { RegisterDto } from './dto/register.dto';

describe('AuthService', () => {
  let moduleRef: TestingModule;
  let authService: AuthService;
  let prisma: PrismaService;
  let setupPrisma: PrismaService;
  let testBrandId: string;
  const createdUserIds: string[] = [];

  function buildRegisterDto(overrides: Partial<RegisterDto> = {}): RegisterDto {
    const unique = randomUUID();
    return {
      brandId: testBrandId,
      email: `test-${unique}@example.com`,
      username: `user_${unique.slice(0, 8)}`,
      phone: `+1555${unique.replace(/\D/g, '').slice(0, 7)}`,
      password: 'correct-horse-battery-staple',
      ...overrides,
    };
  }

  beforeAll(async () => {
    setupPrisma = new PrismaService();
    const unique = randomUUID();
    const brand = await setupPrisma.brand.create({
      data: { name: `Test Brand ${unique}`, slug: `test-brand-${unique}` },
    });
    testBrandId = brand.id;
  });

  afterAll(async () => {
    await setupPrisma.brand.delete({ where: { id: testBrandId } });
    await setupPrisma.$disconnect();
  });

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        PrismaService,
        AuditLogService,
        FreebetService,
        RegisterCampaignService,
        { provide: JwtService, useValue: new JwtService({ secret: 'test-jwt-secret' }) },
      ],
    }).compile();
    await moduleRef.init();

    authService = moduleRef.get(AuthService);
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    }
    await moduleRef.close();
  });

  it('rejects registration for an unknown brand', async () => {
    await expect(
      authService.register(buildRegisterDto({ brandId: 'does-not-exist' })),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('registers a new user and returns an access + refresh token pair', async () => {
    const dto = buildRegisterDto();

    const tokens = await authService.register(dto);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: dto.email } });
    createdUserIds.push(user.id);

    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();
    expect(user.passwordHash).not.toBe(dto.password);
  });

  it('rejects registration with an email that is already taken', async () => {
    const dto = buildRegisterDto();
    const first = await authService.register(dto);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: dto.email } });
    createdUserIds.push(user.id);
    expect(first.accessToken).toBeTruthy();

    await expect(
      authService.register(buildRegisterDto({ email: dto.email })),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('logs in with the correct email + password', async () => {
    const dto = buildRegisterDto();
    await authService.register(dto);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: dto.email } });
    createdUserIds.push(user.id);

    const tokens = await authService.login({ identifier: dto.email, password: dto.password });
    expect(tokens.accessToken).toBeTruthy();
  });

  it('logs in with the correct username + password', async () => {
    const dto = buildRegisterDto();
    await authService.register(dto);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: dto.email } });
    createdUserIds.push(user.id);

    const tokens = await authService.login({ identifier: dto.username, password: dto.password });
    expect(tokens.accessToken).toBeTruthy();
  });

  it('rejects login with the wrong password', async () => {
    const dto = buildRegisterDto();
    await authService.register(dto);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: dto.email } });
    createdUserIds.push(user.id);

    await expect(
      authService.login({ identifier: dto.email, password: 'wrong-password' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects login for an unknown identifier', async () => {
    await expect(
      authService.login({ identifier: 'nobody@example.com', password: 'irrelevant' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('issues a new token pair on refresh and revokes the old refresh token', async () => {
    const dto = buildRegisterDto();
    const { refreshToken } = await authService.register(dto);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: dto.email } });
    createdUserIds.push(user.id);

    const refreshed = await authService.refresh(refreshToken);
    expect(refreshed.accessToken).toBeTruthy();
    expect(refreshed.refreshToken).not.toBe(refreshToken);

    await expect(authService.refresh(refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('logging in from a second device revokes the first device’s refresh token', async () => {
    const dto = buildRegisterDto();
    const { refreshToken: deviceARefreshToken } = await authService.register(dto);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: dto.email } });
    createdUserIds.push(user.id);

    const deviceB = await authService.login({ identifier: dto.email, password: dto.password });
    expect(deviceB.refreshToken).not.toBe(deviceARefreshToken);

    await expect(authService.refresh(deviceARefreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(authService.refresh(deviceB.refreshToken)).resolves.toMatchObject({
      accessToken: expect.any(String),
    });
  });

  it('logout revokes the refresh token so it can no longer be used', async () => {
    const dto = buildRegisterDto();
    const { refreshToken } = await authService.register(dto);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: dto.email } });
    createdUserIds.push(user.id);

    await authService.logout(refreshToken);

    await expect(authService.refresh(refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
