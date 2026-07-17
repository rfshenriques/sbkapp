import { SetMetadata } from '@nestjs/common';
import type { StaffRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/** Use alongside StaffJwtAuthGuard (which must run first) to restrict a route to specific staff roles. */
export const Roles = (...roles: StaffRole[]) => SetMetadata(ROLES_KEY, roles);
