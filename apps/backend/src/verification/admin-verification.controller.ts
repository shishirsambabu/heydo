import { Body, Controller, Get, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsString, MinLength } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import { VerificationError, VerificationService, VerificationSubjectRole } from './verification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser, Roles } from '../auth/decorators';
import { AuthPrincipal } from '../auth/auth.types';

class RejectDto {
  @IsString() @MinLength(3) reason!: string;
}

class RoleParamDto {
  @IsIn(['worker', 'giver']) role!: VerificationSubjectRole;
}

/**
 * The VKYC Verification Queue (admin/ops). Restricted to Verification Officers.
 * Every decision is audited inside the service. This is the backend the Next.js
 * admin panel calls. See docs/phase-0/05-rbac-and-audit.md.
 */
@Controller('admin/verifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('verification_officer')
export class AdminVerificationController {
  constructor(
    private readonly verification: VerificationService,
    private readonly config: ConfigService,
  ) {}

  /** Queue: verifications whose vendor result is in, awaiting officer review. */
  @Get('pending')
  pending() {
    return this.verification.listPendingReview();
  }

  /** Live VKYC integration readiness. Never returns secret values. */
  @Get('readiness')
  readiness() {
    const provider = this.config.get<string>('VKYC_PROVIDER') ?? 'mock';
    const persistence = this.config.get<string>('PERSISTENCE') ?? 'memory';
    const checks = {
      diditProviderEnabled: provider === 'didit',
      diditApiKeyConfigured: Boolean(this.config.get<string>('DIDIT_API_KEY')),
      workerWorkflowConfigured: Boolean(this.config.get<string>('DIDIT_WORKFLOW_ID')),
      giverWorkflowConfigured: Boolean(this.config.get<string>('DIDIT_GIVER_WORKFLOW_ID')),
      webhookSecretConfigured: Boolean(this.config.get<string>('DIDIT_WEBHOOK_SECRET')),
      callbackUrlConfigured: Boolean(this.config.get<string>('DIDIT_CALLBACK_URL')),
      postgresPersistenceEnabled: persistence === 'postgres',
      databaseUrlConfigured: Boolean(this.config.get<string>('DATABASE_URL')),
    };
    const readyForLiveDidit =
      checks.diditProviderEnabled &&
      checks.diditApiKeyConfigured &&
      checks.workerWorkflowConfigured &&
      checks.giverWorkflowConfigured &&
      checks.webhookSecretConfigured &&
      checks.postgresPersistenceEnabled &&
      checks.databaseUrlConfigured;

    return {
      provider,
      persistence,
      webhookDestinationPath: '/webhooks/didit',
      checks,
      readyForLiveDidit,
      nextManualChecks: [
        'Run one worker verification in Didit and confirm the worker remains pending for Heydo review.',
        'Run one giver verification in Didit and confirm the giver becomes approved by Didit.',
        'Send Approved and Declined live callbacks and confirm persisted status changes.',
      ],
    };
  }

  @Get('sessions/:sessionId')
  async lookupBySession(@Param('sessionId') sessionId: string) {
    try {
      return await this.verification.adminLookupBySession(sessionId);
    } catch (error) {
      if (error instanceof VerificationError && error.code === 'not_found') {
        throw new NotFoundException({ code: error.code, message: error.message });
      }
      throw error;
    }
  }

  @Get('users/:userId/:role/latest')
  async latestForUser(@Param('userId') userId: string, @Param() params: RoleParamDto) {
    try {
      return await this.verification.adminLatestForUser(userId, params.role);
    } catch (error) {
      if (error instanceof VerificationError && error.code === 'not_found') {
        throw new NotFoundException({ code: error.code, message: error.message });
      }
      throw error;
    }
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() officer: AuthPrincipal) {
    return this.verification.approve(id, officer.sub);
  }

  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() dto: RejectDto,
    @CurrentUser() officer: AuthPrincipal,
  ) {
    return this.verification.reject(id, officer.sub, dto.reason);
  }
}
