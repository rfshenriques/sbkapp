import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Stopgap only: backoffice staff auth + RBAC is an explicitly deferred open
 * item (see PROJECT_BRIEF.md Section 10 - it's a separate system from player
 * auth, not built yet). Until that exists, admin-only endpoints are gated by
 * a shared secret header instead of leaving them reachable by any logged-in
 * player. Replace this with a real staff-auth guard once that module lands.
 */
@Injectable()
export class AdminKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const providedKey = request.header('x-admin-key');
    const expectedKey = process.env.ADMIN_API_KEY;

    if (!expectedKey || providedKey !== expectedKey) {
      throw new UnauthorizedException('Invalid admin key');
    }
    return true;
  }
}
