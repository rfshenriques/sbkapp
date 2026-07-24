import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtPayload } from './jwt.strategy';

/**
 * Soft auth for player-facing public endpoints (matches, specials,
 * boosts) that need to know "is this viewer logged in, and as whom" for
 * audience targeting, without requiring login to browse at all. Never
 * throws - a missing, malformed, or expired token just resolves to null,
 * same as browsing anonymously.
 */
@Injectable()
export class OptionalPlayerAuthService {
  constructor(private readonly jwtService: JwtService) {}

  async resolve(authorizationHeader: string | undefined): Promise<JwtPayload | null> {
    if (!authorizationHeader?.startsWith('Bearer ')) {
      return null;
    }
    const token = authorizationHeader.slice('Bearer '.length);
    try {
      return await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      return null;
    }
  }
}
