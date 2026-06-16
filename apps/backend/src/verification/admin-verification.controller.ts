import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { VerificationService } from './verification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser, Roles } from '../auth/decorators';
import { AuthPrincipal } from '../auth/auth.types';

class RejectDto {
  @IsString() @MinLength(3) reason!: string;
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
  constructor(private readonly verification: VerificationService) {}

  /** Queue: verifications whose vendor result is in, awaiting officer review. */
  @Get('pending')
  pending() {
    return this.verification.listPendingReview();
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
