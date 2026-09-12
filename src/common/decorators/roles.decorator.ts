import { SetMetadata } from '@nestjs/common';
import { Role } from '../../users/entities/user.entity';

export const ROLES_KEY = 'roles';

/**
 * Restricts a route to the given roles. Must be combined with RolesGuard.
 * Usage: @Roles('ADMIN')
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
