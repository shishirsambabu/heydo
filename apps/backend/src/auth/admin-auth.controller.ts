import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsArray, IsString, MinLength } from 'class-validator';
import { AuditService } from '../common/audit/audit.service';
import { CurrentUser, Roles } from './decorators';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { AdminSessionError, AdminSessionService } from './admin-session.service';
import { AuthService } from './auth.service';
import { AdminRole, AuthPrincipal } from './auth.types';

class AdminDevLoginDto {
  @IsString() secret!: string;
  @IsString() adminId!: string;
  @IsArray() roles!: AdminRole[];
}

class AdminSessionRevokeDto {
  @IsString() @MinLength(10) reason!: string;
}

/**
 * DEV-ONLY admin authentication. Lets us obtain a Verification-Officer token to
 * exercise the admin queue. Replaced by SSO + MFA in Phase 7 hardening.
 */
@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly adminSessions: AdminSessionService,
    private readonly audit: AuditService,
  ) {}

  @Post('dev-login')
  devLogin(@Body() dto: AdminDevLoginDto) {
    return this.auth.adminDevLogin(dto.secret, dto.adminId, dto.roles);
  }

  @Post('sessions/:sessionId/revoke')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  async revokeSession(
    @Param('sessionId') sessionId: string,
    @CurrentUser() principal: AuthPrincipal,
    @Body() dto: AdminSessionRevokeDto,
  ) {
    if (sessionId === principal.adminSessionId) {
      throw new BadRequestException({
        code: 'admin_cannot_revoke_current_session',
        message: 'Use logout or step-up reset for the current admin session',
      });
    }

    try {
      const session = await this.adminSessions.revoke(sessionId);
      this.audit.record({
        actorId: principal.sub,
        actorRole: primaryRole(principal),
        action: 'admin.session_revoked',
        targetType: 'admin_session',
        targetId: sessionId,
        metadata: {
          targetAdminId: session.adminId,
          targetDeviceId: session.deviceId,
          reason: dto.reason.trim(),
        },
      });
      return {
        revoked: true,
        sessionId,
        adminId: session.adminId,
        revokedAt: session.revokedAt,
      };
    } catch (error) {
      if (error instanceof AdminSessionError) {
        if (error.code === 'admin_session_not_found') {
          throw new NotFoundException({ code: error.code, message: error.message });
        }
        throw new ForbiddenException({ code: error.code, message: error.message });
      }
      throw error;
    }
  }
}

function primaryRole(principal: AuthPrincipal): string {
  return principal.roles[0] ?? 'admin';
}
