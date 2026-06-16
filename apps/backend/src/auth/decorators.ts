import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { AuthPrincipal, Role } from './auth.types';

export const ROLES_KEY = 'roles';
/** @Roles('verification_officer') — restrict a route to specific roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** @CurrentUser() — inject the decoded JWT principal into a handler. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthPrincipal => {
    return ctx.switchToHttp().getRequest().user;
  },
);
