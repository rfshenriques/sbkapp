import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { StaffRole } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface StaffJwtPayload {
  sub: string;
  username: string;
  role: StaffRole;
}

/**
 * Registered under the 'staff-jwt' Passport strategy name, deliberately
 * distinct from the player 'jwt' strategy (see ../auth/jwt.strategy.ts) -
 * and signed with a completely separate secret, so a player's token is
 * cryptographically incapable of passing this guard, not just logically
 * rejected by a payload check.
 */
@Injectable()
export class StaffJwtStrategy extends PassportStrategy(Strategy, 'staff-jwt') {
  constructor() {
    const secret = process.env.STAFF_JWT_SECRET;
    if (!secret) {
      throw new Error('STAFF_JWT_SECRET must be set');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: StaffJwtPayload): StaffJwtPayload {
    return payload;
  }
}
