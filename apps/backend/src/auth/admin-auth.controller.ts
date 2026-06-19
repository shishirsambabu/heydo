import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  NotFoundException,
  Param,
  Post,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';
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

class AdminStepUpCompleteDto {
  @IsString() secret!: string;
}

class AdminSessionListQuery {
  @IsOptional() @IsString() limit?: string;
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

  @Get('sessions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  async sessions(@CurrentUser() principal: AuthPrincipal, @Query() query: AdminSessionListQuery) {
    const limit = parseSessionLimit(query.limit);
    const result = await this.adminSessions.listSessions(limit);
    this.audit.record({
      actorId: principal.sub,
      actorRole: primaryRole(principal),
      action: 'admin.sessions_viewed',
      targetType: 'admin_session',
      targetId: 'list',
      metadata: {
        limit,
        returnedCount: result.sessions.length,
        summary: result.summary,
      },
    });
    return result;
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

  @Post('sessions/:sessionId/require-step-up')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  async requireStepUp(
    @Param('sessionId') sessionId: string,
    @CurrentUser() principal: AuthPrincipal,
    @Body() dto: AdminSessionRevokeDto,
  ) {
    try {
      const session = await this.adminSessions.requireStepUp(sessionId, dto.reason);
      this.audit.record({
        actorId: principal.sub,
        actorRole: primaryRole(principal),
        action: 'admin.session_step_up_required',
        targetType: 'admin_session',
        targetId: sessionId,
        metadata: {
          targetAdminId: session.adminId,
          targetDeviceId: session.deviceId,
          reason: dto.reason.trim(),
        },
      });
      return {
        stepUpRequired: true,
        sessionId,
        adminId: session.adminId,
        stepUpRequiredAt: session.stepUpRequiredAt,
      };
    } catch (error) {
      throw mapAdminSessionError(error);
    }
  }

  @Post('sessions/current/dev-step-up')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('verification_officer', 'dispute_officer', 'fraud_analyst', 'finance', 'support', 'super_admin')
  async devCompleteStepUp(
    @CurrentUser() principal: AuthPrincipal,
    @Body() dto: AdminStepUpCompleteDto,
  ) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException({
        code: 'dev_step_up_disabled',
        message: 'Dev step-up is disabled in production',
      });
    }
    const expected = process.env.ADMIN_DEV_SECRET ?? 'dev-admin-secret';
    if (dto.secret !== expected) {
      throw new ForbiddenException({ code: 'bad_admin_secret', message: 'Bad admin secret' });
    }

    try {
      const session = await this.adminSessions.completeStepUp(principal);
      this.audit.record({
        actorId: principal.sub,
        actorRole: primaryRole(principal),
        action: 'admin.session_step_up_completed',
        targetType: 'admin_session',
        targetId: session.id,
        metadata: { deviceId: session.deviceId },
      });
      return {
        stepUpCompleted: true,
        sessionId: session.id,
        mfaVerifiedAt: session.mfaVerifiedAt,
      };
    } catch (error) {
      throw mapAdminSessionError(error);
    }
  }
}

function primaryRole(principal: AuthPrincipal): string {
  return principal.roles[0] ?? 'admin';
}

function parseSessionLimit(value?: string): number {
  if (!value) return 100;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 200) {
    throw new BadRequestException({
      code: 'invalid_admin_session_limit',
      message: 'Session list limit must be an integer between 1 and 200',
    });
  }
  return parsed;
}

function mapAdminSessionError(error: unknown): never {
  if (error instanceof AdminSessionError) {
    if (error.code === 'admin_session_not_found') {
      throw new NotFoundException({ code: error.code, message: error.message });
    }
    throw new ForbiddenException({ code: error.code, message: error.message });
  }
  throw error;
}
