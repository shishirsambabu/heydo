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
@Roles('fraud_analyst', 'support', 'super_admin')
export class AdminMarketplaceController {
  constructor(
    private readonly marketplace: MarketplaceService,
    private readonly money: MoneyService,
    private readonly audit: AuditService,
  ) {}

  @Get('gigs')
  adminGigs(@Query('visibilityStatus') visibilityStatus?: string, @Query('status') status?: string) {
    return this.marketplace.listGigsForAdmin({ visibilityStatus, status });
  }

  @Get('gigs/pending-review')
  pendingReview() {
    return this.marketplace.listGigsForAdmin({ visibilityStatus: 'pending_review' });
  }

  @Get('gigs/:gigId/money-trail')
  moneyTrail(@Param('gigId') gigId: string) {
    return this.money.moneyTrailForGig(gigId);
  }

  @Get('gigs/:gigId/audit-trail')
  gigAuditTrail(@Param('gigId') gigId: string) {
    return this.audit
      .list()
      .filter(
        (entry) =>
          (entry.targetType === 'gig' && entry.targetId === gigId) ||
          entry.metadata?.gigId === gigId,
      );
  }

  @Post('gigs/:gigId/approve')
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
  safetyReports(@Query('status') status?: string, @Query('gigId') gigId?: string) {
    return this.marketplace.listSafetyReports({ status, gigId });
  }

  @Get('safety-reports/:reportId/audit-trail')
  safetyReportAuditTrail(@Param('reportId') reportId: string) {
    return this.audit.list({ targetType: 'safety_report', targetId: reportId });
  }

  @Post('safety-reports/:reportId/review')
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
