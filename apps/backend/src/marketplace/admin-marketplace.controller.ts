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
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { SafetyReportStatus } from './marketplace.entities';
import { AuthPrincipal } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuditService } from '../common/audit/audit.service';
import { MoneyService } from '../money/money.service';
import { MarketplaceError, MarketplaceService } from './marketplace.service';

class ModerationDto {
  @IsString() @MinLength(3) reason!: string;
}

class SafetyReviewDto {
  @IsString() status!: Extract<SafetyReportStatus, 'under_review' | 'action_taken' | 'escalated' | 'closed'>;
  @IsString() @MinLength(3) actionTaken!: string;
  @IsOptional() @IsString() lawEnforcementRef?: string;
}

class DisputeResolutionDto {
  @IsString() outcome!: 'release_to_worker' | 'refund_giver' | 'keep_escalated';
  @IsString() @MinLength(3) actionTaken!: string;
  @IsOptional() @IsString() lawEnforcementRef?: string;
}

@Controller('admin/marketplace')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
export class AdminMarketplaceController {
  constructor(
    private readonly marketplace: MarketplaceService,
    private readonly money: MoneyService,
    private readonly audit: AuditService,
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

  @Get('gigs/:gigId/money-trail')
  @Roles('finance', 'dispute_officer', 'super_admin')
  async moneyTrail(@Param('gigId') gigId: string, @CurrentUser() principal: AuthPrincipal) {
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

  @Post('gigs/:gigId/approve')
  @Roles('fraud_analyst', 'dispute_officer', 'super_admin')
  approve(
    @Param('gigId') gigId: string,
    @CurrentUser() principal: AuthPrincipal,
    @Body() dto: ModerationDto,
  ) {
    return this.wrap(() =>
      this.marketplace.moderateGig(gigId, principal.sub, 'approve', dto.reason),
    );
  }

  @Post('gigs/:gigId/reject')
  @Roles('fraud_analyst', 'dispute_officer', 'super_admin')
  reject(
    @Param('gigId') gigId: string,
    @CurrentUser() principal: AuthPrincipal,
    @Body() dto: ModerationDto,
  ) {
    return this.wrap(() =>
      this.marketplace.moderateGig(gigId, principal.sub, 'reject', dto.reason),
    );
  }

  @Post('gigs/:gigId/flag')
  @Roles('fraud_analyst', 'dispute_officer', 'super_admin')
  flag(
    @Param('gigId') gigId: string,
    @CurrentUser() principal: AuthPrincipal,
    @Body() dto: ModerationDto,
  ) {
    return this.wrap(() =>
      this.marketplace.moderateGig(gigId, principal.sub, 'flag', dto.reason),
    );
  }

  @Get('safety-reports')
  @Roles('support', 'fraud_analyst', 'dispute_officer', 'super_admin')
  safetyReports(@Query('status') status?: string, @Query('gigId') gigId?: string) {
    return this.marketplace.listSafetyReports({ status, gigId });
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
    return this.wrap(() =>
      this.marketplace.listSafetyReportEvidenceRefs(reportId, principal.sub, principal.roles),
    );
  }

  @Post('safety-reports/:reportId/review')
  @Roles('fraud_analyst', 'dispute_officer', 'super_admin')
  reviewSafetyReport(
    @Param('reportId') reportId: string,
    @CurrentUser() principal: AuthPrincipal,
    @Body() dto: SafetyReviewDto,
  ) {
    return this.wrap(() =>
      this.marketplace.reviewSafetyReport(
        reportId,
        principal.sub,
        dto.status,
        dto.actionTaken,
        dto.lawEnforcementRef,
      ),
    );
  }

  @Post('safety-reports/:reportId/resolve-dispute')
  @Roles('dispute_officer', 'super_admin')
  resolveDispute(
    @Param('reportId') reportId: string,
    @CurrentUser() principal: AuthPrincipal,
    @Body() dto: DisputeResolutionDto,
  ) {
    return this.wrap(() =>
      this.marketplace.resolveSafetyDispute(
        reportId,
        principal.sub,
        dto.outcome,
        dto.actionTaken,
        dto.lawEnforcementRef,
      ),
    );
  }

  @Post('safety-reports/:reportId/escalation-package')
  @Roles('fraud_analyst', 'dispute_officer', 'super_admin')
  escalationPackage(
    @Param('reportId') reportId: string,
    @CurrentUser() principal: AuthPrincipal,
  ) {
    return this.wrap(() =>
      this.marketplace.generateSafetyEscalationPackage(reportId, principal.sub),
    );
  }

  @Get('escalation-packages/:packageId')
  @Roles('fraud_analyst', 'dispute_officer', 'super_admin')
  retrieveEscalationPackage(
    @Param('packageId') packageId: string,
    @CurrentUser() principal: AuthPrincipal,
  ) {
    return this.wrap(() =>
      this.marketplace.retrieveSafetyEscalationPackage(packageId, principal.sub),
    );
  }

  private async wrap<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof MarketplaceError) {
        if (error.code === 'not_found') throw new NotFoundException(error.message);
        if (error.code === 'forbidden') throw new ForbiddenException(error.message);
        if (['invalid_state', 'already_assigned'].includes(error.code)) {
          throw new ConflictException({ code: error.code, message: error.message });
        }
        throw new BadRequestException({ code: error.code, message: error.message });
      }
      throw error;
    }
  }
}

function primaryRole(principal: AuthPrincipal): string {
  return principal.roles[0] ?? 'admin';
}
