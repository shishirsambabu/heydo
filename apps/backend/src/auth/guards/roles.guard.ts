import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators';
import { AuthPrincipal, Role } from '../auth.types';

/**
 * Enforces @Roles(...) — least-privilege. Must run after JwtAuthGuard
 * (which populates req.user). No roles required => allow any authenticated user.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user: AuthPrincipal | undefined = context.switchToHttp().getRequest().user;
    if (!user) throw new ForbiddenException('Not authenticated');
    const ok = user.roles?.some((r) => required.includes(r));
    if (!ok) throw new ForbiddenException('Insufficient role');
    return true;
  }
}
