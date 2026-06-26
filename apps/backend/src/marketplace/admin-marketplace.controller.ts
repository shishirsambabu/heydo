import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { RatingDirection, SafetyReportStatus } from './marketplace.entities';
import { AdminSessionError, AdminSessionService } from '../auth/admin-session.service';
import { AuthPrincipal } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuditHealthError, AuditService } from '../common/audit/audit.service';
import { MoneyService } from '../money/money.service';
import {
  ADMIN_DECISION_REASON_CATALOG,
  AdminDecisionNote,
  AdminDecisionReasonAction,
  MarketplaceError,
  MarketplaceService,
  OPERATOR_POLICY_MATRIX,
} from './marketplace.service';

class ModerationDto {
  @IsString() @MinLength(3) reasonCode!: string;
  @IsString() @MinLength(10) note!: string;
}

class SafetyReviewDto {
  @IsString() status!: Extract<SafetyReportStatus, 'under_review' | 'action_taken' | 'escalated' | 'closed'>;
  @IsString() @MinLength(3) reasonCode!: string;
  @IsString() @MinLength(10) note!: string;
  @IsOptional() @IsString() lawEnforcementRef?: string;
}

class DisputeResolutionDto {
  @IsString() outcome!: 'release_to_worker' | 'refund_giver' | 'keep_escalated';
  @IsString() @MinLength(3) reasonCode!: string;
  @IsString() @MinLength(10) note!: string;
  @IsOptional() @IsString() lawEnforcementRef?: string;
}

class EscalationPackageDto {
  @IsString() @MinLength(3) reasonCode!: string;
  @IsString() @MinLength(10) note!: string;
}

class LowRatingSafetyReportDto {
  @IsString() direction!: RatingDirection;
  @IsString() @MinLength(10) note!: string;
}

class AuditRecoveryDto {
  @IsString() @MinLength(10) reason!: string;
  @IsString() @MinLength(3) remediationRef!: string;
  @IsString() @MinLength(3) investigatedByAdminId!: string;
}

class ProposalTokenGrantDto {
  @IsInt() @Min(1) @Max(100) amount!: number;
  @IsString() @MinLength(3) reasonCode!: string;
  @IsString() @MinLength(10) note!: string;
}

@Controller('admin/marketplace')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
export class AdminMarketplaceController {
  constructor(
    private readonly marketplace: MarketplaceService,
    private readonly money: MoneyService,
    private readonly audit: AuditService,
    private readonly adminSessions: AdminSessionService,
  ) {}

  @Get('gigs')
  @Roles('support', 'fraud_analyst', 'dispute_officer', 'super_admin')
  adminGigs(@Query('visibilityStatus') visibilityStatus?: string, @Query('status') status?: string) {
    return this.marketplace.listGigsForAdmin({ visibilityStatus, status });
  }

  @Get('gigs/pending-review')
  @Roles('fraud_analyst', 'dispute_officer', 'super_admin')
  pendingReview() {
    return this.marketplace.listGigsForAdmin({ visibilityStatus: 'pending_review' });
  }

  @Post('proposal-tokens/:workerId/grant')
  @Roles('finance', 'super_admin')
  grantProposalTokens(
    @Param('workerId') workerId: string,
    @CurrentUser() principal: AuthPrincipal,
    @Body() dto: ProposalTokenGrantDto,
  ) {
    return this.wrap(async () => {
      this.audit.assertHealthyForSensitiveAction();
      await this.adminSessions.assertFresh(principal);
      return this.marketplace.grantProposalTokens(
        workerId,
        dto.amount,
        principal.sub,
        decisionFromDto('proposal_tokens.grant', dto),
      );
    });
  }

  @Get('proposal-tokens/:workerId/audit-trail')
  @Roles('finance', 'super_admin')
  async proposalTokenAuditTrail(
    @Param('workerId') workerId: string,
    @CurrentUser() principal: AuthPrincipal,
  ) {
    const [grants, applicationDebits] = await Promise.all([
      this.audit.list({ targetType: 'worker', targetId: workerId, actionPrefix: 'proposal_tokens.' }),
      this.audit.list({ actorId: workerId, actionPrefix: 'gig.application_submitted' }),
    ]);
    const tokenDebits = applicationDebits.filter(
      (entry) => Number(entry.metadata?.negotiationTokenCost ?? 0) > 0,
    );
    const byId = new Map([...grants, ...tokenDebits].map((entry) => [entry.id, entry]));
    const trail = [...byId.values()].sort((a, b) => a.at.localeCompare(b.at));
    this.audit.record({
      actorId: principal.sub,
      actorRole: primaryRole(principal),
      action: 'admin.proposal_token_audit_trail_viewed',
      targetType: 'worker',
      targetId: workerId,
      metadata: { auditRecordCount: trail.length },
    });
    return trail;
  }

  @Get('economics')
  @Roles('finance', 'fraud_analyst', 'dispute_officer', 'super_admin')
  economics() {
    return this.marketplace.marketplaceEconomicsForAdmin();
  }

  @Get('gigs/:gigId/money-trail')
  @Roles('finance', 'dispute_officer', 'super_admin')
  async moneyTrail(@Param('gigId') gigId: string, @CurrentUser() principal: AuthPrincipal) {
    return this.wrap(async () => {
      this.audit.assertHealthyForSensitiveAction();
      await this.adminSessions.assertFresh(principal);
      const trail = await this.money.moneyTrailForGig(gigId);
      this.audit.record({
        actorId: principal.sub,
        actorRole: primaryRole(principal),
        action: 'admin.money_trail_viewed',
        targetType: 'gig',
        targetId: gigId,
        metadata: {
          holdPresent: Boolean(trail.hold),
          transactionCount: trail.transactions.length,
        },
      });
      return trail;
    });
  }

  @Get('gigs/:gigId/audit-trail')
  @Roles('fraud_analyst', 'dispute_officer', 'super_admin')
  async gigAuditTrail(@Param('gigId') gigId: string, @CurrentUser() principal: AuthPrincipal) {
    const [direct, linked] = await Promise.all([
      this.audit.list({ targetType: 'gig', targetId: gigId }),
      this.audit.list({ metadata: { gigId } }),
    ]);
    const byId = new Map([...direct, ...linked].map((entry) => [entry.id, entry]));
    const trail = [...byId.values()].sort((a, b) => a.at.localeCompare(b.at));
    this.audit.record({
      actorId: principal.sub,
      actorRole: primaryRole(principal),
      action: 'admin.gig_audit_trail_viewed',
      targetType: 'gig',
      targetId: gigId,
      metadata: { auditRecordCount: trail.length },
    });
    return trail;
  }

  @Get('audit-health')
  @Roles('super_admin')
  auditHealth() {
    return this.audit.health();
  }

  @Post('audit-health/restore')
  @Roles('super_admin')
  restoreAuditHealth(
    @CurrentUser() principal: AuthPrincipal,
    @Body() dto: AuditRecoveryDto,
  ) {
    return this.wrap(async () => {
      await this.adminSessions.assertFresh(principal);
      const investigatedByAdminId = dto.investigatedByAdminId.trim();
      if (investigatedByAdminId === principal.sub) {
        throw new MarketplaceError(
          'A second super admin is required to restore audit operations',
          'second_reviewer_required',
        );
      }
      return this.audit.restoreAfterInvestigation({
        actorId: principal.sub,
        actorRole: primaryRole(principal),
        action: 'admin.audit_recovery_confirmed',
        targetType: 'audit_log',
        targetId: 'health',
        metadata: {
          reason: dto.reason.trim(),
          remediationRef: dto.remediationRef.trim(),
          investigatedByAdminId,
        },
      });
    });
  }

  @Get('decision-reasons')
  @Roles('fraud_analyst', 'dispute_officer', 'finance', 'support', 'super_admin')
  decisionReasons() {
    return ADMIN_DECISION_REASON_CATALOG;
  }

  @Get('operator-policy-matrix')
  @Roles('fraud_analyst', 'dispute_officer', 'finance', 'support', 'super_admin')
  operatorPolicyMatrix() {
    return OPERATOR_POLICY_MATRIX;
  }

  @Get('reputation/low-ratings')
  @Roles('fraud_analyst', 'dispute_officer', 'super_admin')
  async lowRatingReviews(@CurrentUser() principal: AuthPrincipal) {
    const items = await this.marketplace.listLowRatingReviewItems();
    this.audit.record({
      actorId: principal.sub,
      actorRole: primaryRole(principal),
      action: 'admin.low_rating_review_queue_viewed',
      targetType: 'reputation',
      targetId: 'low_ratings',
      metadata: { itemCount: items.length },
    });
    return items;
  }

  @Post('gigs/:gigId/ratings/safety-report')
  @Roles('fraud_analyst', 'dispute_officer', 'super_admin')
  openSafetyReportFromRating(
    @Param('gigId') gigId: string,
    @CurrentUser() principal: AuthPrincipal,
    @Body() dto: LowRatingSafetyReportDto,
  ) {
    return this.wrap(async () => {
      this.audit.assertHealthyForSensitiveAction();
      await this.adminSessions.assertFresh(principal);
      return this.marketplace.openSafetyReportFromRating(
        gigId,
        dto.direction,
        principal.sub,
        dto.note,
      );
    });
  }

  @Post('gigs/:gigId/approve')
  @Roles('fraud_analyst', 'dispute_officer', 'super_admin')
  approve(
    @Param('gigId') gigId: string,
    @CurrentUser() principal: AuthPrincipal,
    @Body() dto: ModerationDto,
  ) {
    return this.wrap(async () => {
      this.audit.assertHealthyForSensitiveAction();
      await this.adminSessions.assertFresh(principal);
      return this.marketplace.moderateGig(
        gigId,
        principal.sub,
        'approve',
        dto.note,
        decisionFromDto('gig.approve', dto),
      );
    });
  }

  @Post('gigs/:gigId/reject')
  @Roles('fraud_analyst', 'dispute_officer', 'super_admin')
  reject(
    @Param('gigId') gigId: string,
    @CurrentUser() principal: AuthPrincipal,
    @Body() dto: ModerationDto,
  ) {
    return this.wrap(async () => {
      this.audit.assertHealthyForSensitiveAction();
      await this.adminSessions.assertFresh(principal);
      return this.marketplace.moderateGig(
        gigId,
        principal.sub,
        'reject',
        dto.note,
        decisionFromDto('gig.reject', dto),
      );
    });
  }

  @Post('gigs/:gigId/flag')
  @Roles('fraud_analyst', 'dispute_officer', 'super_admin')
  flag(
    @Param('gigId') gigId: string,
    @CurrentUser() principal: AuthPrincipal,
    @Body() dto: ModerationDto,
  ) {
    return this.wrap(async () => {
      this.audit.assertHealthyForSensitiveAction();
      await this.adminSessions.assertFresh(principal);
      return this.marketplace.moderateGig(
        gigId,
        principal.sub,
        'flag',
        dto.note,
        decisionFromDto('gig.flag', dto),
      );
    });
  }

  @Get('safety-reports')
  @Roles('support', 'fraud_analyst', 'dispute_officer', 'super_admin')
  safetyReports(@Query('status') status?: string, @Query('gigId') gigId?: string) {
    return this.marketplace.listSafetyReportsForAdmin({ status, gigId });
  }

  @Get('safety-reports/:reportId/audit-trail')
  @Roles('fraud_analyst', 'dispute_officer', 'super_admin')
  async safetyReportAuditTrail(
    @Param('reportId') reportId: string,
    @CurrentUser() principal: AuthPrincipal,
  ) {
    const trail = await this.audit.list({ targetType: 'safety_report', targetId: reportId });
    this.audit.record({
      actorId: principal.sub,
      actorRole: primaryRole(principal),
      action: 'admin.safety_report_audit_trail_viewed',
      targetType: 'safety_report',
      targetId: reportId,
      metadata: { auditRecordCount: trail.length },
    });
    return trail;
  }

  @Get('safety-reports/:reportId/evidence-refs')
  @Roles('fraud_analyst', 'dispute_officer', 'super_admin')
  safetyReportEvidenceRefs(
    @Param('reportId') reportId: string,
    @CurrentUser() principal: AuthPrincipal,
  ) {
    return this.wrap(async () => {
      this.audit.assertHealthyForSensitiveAction();
      await this.adminSessions.assertFresh(principal);
      return this.marketplace.listSafetyReportEvidenceRefs(reportId, principal.sub, principal.roles);
    });
  }

  @Post('safety-reports/:reportId/review')
  @Roles('fraud_analyst', 'dispute_officer', 'super_admin')
  reviewSafetyReport(
    @Param('reportId') reportId: string,
    @CurrentUser() principal: AuthPrincipal,
    @Body() dto: SafetyReviewDto,
  ) {
    return this.wrap(async () => {
      this.audit.assertHealthyForSensitiveAction();
      await this.adminSessions.assertFresh(principal);
      return this.marketplace.reviewSafetyReport(
        reportId,
        principal.sub,
        dto.status,
        dto.note,
        dto.lawEnforcementRef,
        decisionFromDto(`safety.${dto.status}` as AdminDecisionReasonAction, dto, {
          lawEnforcementRef: dto.lawEnforcementRef,
        }),
      );
    });
  }

  @Post('safety-reports/:reportId/deactivate-giver')
  @Roles('fraud_analyst', 'dispute_officer', 'super_admin')
  deactivateGiverFromSafetyReport(
    @Param('reportId') reportId: string,
    @CurrentUser() principal: AuthPrincipal,
    @Body() dto: ModerationDto,
  ) {
    return this.wrap(async () => {
      this.audit.assertHealthyForSensitiveAction();
      await this.adminSessions.assertFresh(principal);
      return this.marketplace.deactivateGiverFromSafetyReport(
        reportId,
        principal.sub,
        decisionFromDto('giver.deactivate_abusive', dto),
      );
    });
  }

  @Post('safety-reports/:reportId/suspend-worker')
  @Roles('fraud_analyst', 'dispute_officer', 'super_admin')
  suspendWorkerFromSafetyReport(
    @Param('reportId') reportId: string,
    @CurrentUser() principal: AuthPrincipal,
    @Body() dto: ModerationDto,
  ) {
    return this.wrap(async () => {
      this.audit.assertHealthyForSensitiveAction();
      await this.adminSessions.assertFresh(principal);
      return this.marketplace.suspendWorkerFromSafetyReport(
        reportId,
        principal.sub,
        decisionFromDto('worker.suspend_abusive', dto),
      );
    });
  }

  @Post('safety-reports/:reportId/resolve-dispute')
  @Roles('dispute_officer', 'super_admin')
  resolveDispute(
    @Param('reportId') reportId: string,
    @CurrentUser() principal: AuthPrincipal,
    @Body() dto: DisputeResolutionDto,
  ) {
    return this.wrap(async () => {
      this.audit.assertHealthyForSensitiveAction();
      await this.adminSessions.assertFresh(principal);
      return this.marketplace.resolveSafetyDispute(
        reportId,
        principal.sub,
        dto.outcome,
        dto.note,
        dto.lawEnforcementRef,
        decisionFromDto(`dispute.${dto.outcome}` as AdminDecisionReasonAction, dto),
      );
    });
  }

  @Post('safety-reports/:reportId/escalation-package')
  @Roles('fraud_analyst', 'dispute_officer', 'super_admin')
  escalationPackage(
    @Param('reportId') reportId: string,
    @CurrentUser() principal: AuthPrincipal,
    @Body() dto: EscalationPackageDto,
  ) {
    return this.wrap(async () => {
      this.audit.assertHealthyForSensitiveAction();
      await this.adminSessions.assertFresh(principal);
      return this.marketplace.generateSafetyEscalationPackage(
        reportId,
        principal.sub,
        decisionFromDto('escalation.generate', dto),
      );
    });
  }

  @Get('escalation-packages/:packageId')
  @Roles('fraud_analyst', 'dispute_officer', 'super_admin')
  retrieveEscalationPackage(
    @Param('packageId') packageId: string,
    @CurrentUser() principal: AuthPrincipal,
  ) {
    return this.wrap(async () => {
      this.audit.assertHealthyForSensitiveAction();
      await this.adminSessions.assertFresh(principal);
      return this.marketplace.retrieveSafetyEscalationPackage(packageId, principal.sub);
    });
  }

  private async wrap<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof MarketplaceError) {
        if (error.code === 'not_found') throw new NotFoundException(error.message);
        if (error.code === 'admin_fresh_verification_required') {
          throw new ForbiddenException({ code: error.code, message: error.message });
        }
        if (error.code === 'forbidden') throw new ForbiddenException(error.message);
        if (['invalid_state', 'already_assigned'].includes(error.code)) {
          throw new ConflictException({ code: error.code, message: error.message });
        }
        throw new BadRequestException({ code: error.code, message: error.message });
      }
      if (error instanceof AdminSessionError) {
        throw new ForbiddenException({ code: error.code, message: error.message });
      }
      if (error instanceof AuditHealthError) {
        throw new ServiceUnavailableException({
          code: error.code,
          message: error.message,
          failedWriteCount: error.health.failedWriteCount,
        });
      }
      throw error;
    }
  }
}

function primaryRole(principal: AuthPrincipal): string {
  return principal.roles[0] ?? 'admin';
}

function decisionFromDto(
  action: AdminDecisionReasonAction,
  dto: { reasonCode: string; note: string },
  options: { lawEnforcementRef?: string } = {},
): AdminDecisionNote {
  const reasonCode = dto.reasonCode.trim();
  const allowed = ADMIN_DECISION_REASON_CATALOG[action] ?? [];
  const reason = allowed.find((item) => item.code === reasonCode);
  if (!reason) {
    throw new MarketplaceError(`Unsupported decision reason for ${action}`, 'invalid_decision_reason');
  }
  if (reason.requiresLawEnforcementRef && !options.lawEnforcementRef?.trim()) {
    throw new MarketplaceError('Law enforcement reference required for this decision reason', 'law_enforcement_ref_required');
  }
  return {
    reasonCode,
    note: dto.note.trim(),
  };
}
