import { randomUUID } from 'node:crypto';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { WebAuthnService } from './webauthn.service';

describe('WebAuthnService', () => {
  let moduleRef: TestingModule;
  let service: WebAuthnService;
  let prisma: PrismaService;
  let setupPrisma: PrismaService;
  let testBrandId: string;
  let userId: string;
  let username: string;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    setupPrisma = new PrismaService();
    const unique = randomUUID();
    const brand = await setupPrisma.brand.create({
      data: { name: `Test Brand ${unique}`, slug: `test-brand-${unique}` },
    });
    testBrandId = brand.id;
  });

  afterAll(async () => {
    await setupPrisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await setupPrisma.brand.delete({ where: { id: testBrandId } });
    await setupPrisma.$disconnect();
  });

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        WebAuthnService,
        AuthService,
        PrismaService,
        { provide: JwtService, useValue: new JwtService({ secret: 'test-jwt-secret' }) },
      ],
    }).compile();
    await moduleRef.init();

    service = moduleRef.get(WebAuthnService);
    prisma = moduleRef.get(PrismaService);

    const unique = randomUUID();
    username = `user_${unique.slice(0, 8)}`;
    const user = await prisma.user.create({
      data: {
        email: `test-${unique}@example.com`,
        username,
        phone: `+1555${unique.replace(/\D/g, '').slice(0, 7)}`,
        passwordHash: 'irrelevant',
        brandId: testBrandId,
      },
    });
    userId = user.id;
    createdUserIds.push(userId);
  });

  afterEach(async () => {
    await prisma.webAuthnChallenge.deleteMany({});
    await prisma.webAuthnCredential.deleteMany({ where: { userId } });
    await moduleRef.close();
  });

  async function createTestCredential(overrides: Partial<{ credentialId: string; nickname: string }> = {}) {
    return prisma.webAuthnCredential.create({
      data: {
        userId,
        credentialId: overrides.credentialId ?? `cred-${randomUUID()}`,
        publicKey: Buffer.from('fake-public-key'),
        counter: 0,
        transports: ['internal'],
        deviceType: 'singleDevice',
        backedUp: false,
        nickname: overrides.nickname,
      },
    });
  }

  describe('generateRegistrationOptionsForUser', () => {
    it('scopes the challenge to rpID and the player, and excludes their existing credentials', async () => {
      const existing = await createTestCredential();

      const options = await service.generateRegistrationOptionsForUser(userId, 'example.com', 'Example Sportsbook');

      expect(options.rp.id).toBe('example.com');
      expect(options.rp.name).toBe('Example Sportsbook');
      expect(options.user.name).toBe(username);
      expect(options.excludeCredentials?.map((cred) => cred.id)).toEqual([existing.credentialId]);
      expect(options.authenticatorSelection?.residentKey).toBe('required');

      const challenge = await prisma.webAuthnChallenge.findUnique({ where: { challenge: options.challenge } });
      expect(challenge?.userId).toBe(userId);
      expect(challenge && challenge.expiresAt > new Date()).toBe(true);
    });
  });

  describe('generateLoginOptions', () => {
    it('is scoped to rpID with no allowCredentials, and records a userId-less challenge', async () => {
      const options = await service.generateLoginOptions('example.com');

      expect(options.rpId).toBe('example.com');
      expect(options.allowCredentials ?? []).toEqual([]);

      const challenge = await prisma.webAuthnChallenge.findUnique({ where: { challenge: options.challenge } });
      expect(challenge?.userId).toBeNull();
    });
  });

  describe('verifyLogin', () => {
    it('rejects an assertion for a credential id that was never registered', async () => {
      const fakeResponse = { id: 'never-registered' } as AuthenticationResponseJSON;

      await expect(service.verifyLogin(fakeResponse, 'example.com', 'https://example.com')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('listCredentials / removeCredential', () => {
    it('lists only the requesting player’s own credentials, newest last', async () => {
      const first = await createTestCredential({ nickname: 'iPhone' });
      await new Promise((resolve) => setTimeout(resolve, 5));
      const second = await createTestCredential({ nickname: 'MacBook' });

      const summaries = await service.listCredentials(userId);

      expect(summaries.map((summary) => summary.id)).toEqual([first.id, second.id]);
      expect(summaries.map((summary) => summary.nickname)).toEqual(['iPhone', 'MacBook']);
    });

    it('removes a credential belonging to the requesting player', async () => {
      const credential = await createTestCredential();

      await service.removeCredential(userId, credential.id);

      expect(await prisma.webAuthnCredential.findUnique({ where: { id: credential.id } })).toBeNull();
    });

    it('rejects removing a credential that belongs to a different player', async () => {
      const otherUnique = randomUUID();
      const otherUser = await prisma.user.create({
        data: {
          email: `test-${otherUnique}@example.com`,
          username: `user_${otherUnique.slice(0, 8)}`,
          phone: `+1555${otherUnique.replace(/\D/g, '').slice(0, 7)}`,
          passwordHash: 'irrelevant',
          brandId: testBrandId,
        },
      });
      createdUserIds.push(otherUser.id);
      const credential = await prisma.webAuthnCredential.create({
        data: {
          userId: otherUser.id,
          credentialId: `cred-${randomUUID()}`,
          publicKey: Buffer.from('fake-public-key'),
          counter: 0,
          transports: [],
          deviceType: 'singleDevice',
          backedUp: false,
        },
      });

      await expect(service.removeCredential(userId, credential.id)).rejects.toBeInstanceOf(BadRequestException);

      await prisma.webAuthnCredential.deleteMany({ where: { userId: otherUser.id } });
    });
  });
});
