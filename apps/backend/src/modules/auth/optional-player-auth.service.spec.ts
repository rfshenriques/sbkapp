import { JwtService } from '@nestjs/jwt';
import { describe, expect, it } from 'vitest';
import type { JwtPayload } from './jwt.strategy';
import { OptionalPlayerAuthService } from './optional-player-auth.service';

describe('OptionalPlayerAuthService', () => {
  const jwtService = new JwtService({ secret: 'test-jwt-secret' });
  const service = new OptionalPlayerAuthService(jwtService);
  const payload: JwtPayload = { sub: 'user-1', username: 'alice', email: 'alice@example.com', brandId: 'brand-1' };

  it('resolves a valid Bearer token to its payload', async () => {
    const token = jwtService.sign(payload);
    expect(await service.resolve(`Bearer ${token}`)).toMatchObject(payload);
  });

  it('resolves undefined header to null', async () => {
    expect(await service.resolve(undefined)).toBeNull();
  });

  it('resolves a non-Bearer header to null', async () => {
    expect(await service.resolve('Basic abc123')).toBeNull();
  });

  it('resolves a malformed token to null instead of throwing', async () => {
    expect(await service.resolve('Bearer not-a-real-token')).toBeNull();
  });

  it('resolves a token signed with a different secret to null', async () => {
    const otherJwtService = new JwtService({ secret: 'a-different-secret' });
    const token = otherJwtService.sign(payload);
    expect(await service.resolve(`Bearer ${token}`)).toBeNull();
  });

  it('resolves an expired token to null', async () => {
    const token = jwtService.sign(payload, { expiresIn: '-1s' });
    expect(await service.resolve(`Bearer ${token}`)).toBeNull();
  });
});
