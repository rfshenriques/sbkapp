import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Bootstrap-only gate, now narrowed to just staff-user provisioning
 * (POST /admin/staff-users) - real staff auth (see staff-auth.service.ts)
 * handles everything else, including bet settlement, which used to sit
 * behind this same guard. There's no other way to create the first staff
 * account without a chicken-and-egg problem, so this stays as the seam
 * for that one action.
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
