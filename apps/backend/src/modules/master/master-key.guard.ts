import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Bootstrap-only gate for the very first master user - same reasoning as
 * AdminKeyGuard (../admin/admin-key.guard.ts): there's no other way to
 * create the first account without a chicken-and-egg problem, so a shared
 * key is the seam for that one action only.
 */
@Injectable()
export class MasterKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const providedKey = request.header('x-master-admin-key');
    const expectedKey = process.env.MASTER_ADMIN_KEY;

    if (!expectedKey || providedKey !== expectedKey) {
      throw new UnauthorizedException('Invalid master admin key');
    }
    return true;
  }
}
