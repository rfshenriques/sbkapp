import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface MasterJwtPayload {
  sub: string;
  username: string;
}

/**
 * Registered under the 'master-jwt' Passport strategy name - deliberately
 * distinct from both the player 'jwt' strategy and the staff 'staff-jwt'
 * strategy, and signed with its own secret, so neither a player's nor a
 * staff member's token is cryptographically capable of passing this guard.
 */
@Injectable()
export class MasterJwtStrategy extends PassportStrategy(Strategy, 'master-jwt') {
  constructor() {
    const secret = process.env.MASTER_JWT_SECRET;
    if (!secret) {
      throw new Error('MASTER_JWT_SECRET must be set');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: MasterJwtPayload): MasterJwtPayload {
    return payload;
  }
}
