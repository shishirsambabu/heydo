import { randomBytes } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { AuditService } from '../common/audit/audit.service';
import { GiverProfileRepository } from '../identity/identity.repository';
import { MoneyService } from '../money/money.service';
import { VerificationService } from '../verification/verification.service';
import {
  Assignment,
  Category,
  DEFAULT_PRICING_GUIDES,
  Gig,
  GigApplication,
  GigStatus,
  PricingGuide,
  SafetyReport,
  SafetyReportReason,
  SafetyReportSeverity,
  SafetyReportStatus,
} from './marketplace.entities';
import {
  APPLICATION_REPOSITORY,
  ASSIGNMENT_REPOSITORY,
  SAFETY_REPORT_REPOSITORY,
  ApplicationRepository,
  AssignmentRepository,
  CATEGORY_REPOSITORY,
  CategoryRepository,
  GIG_REPOSITORY,
  GigFilters,
  GigRepository,
  SafetyReportRepository,
} from './marketplace.repository';

export class MarketplaceError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'MarketplaceError';
  }
}

export interface PostGigInput {
  categoryId: string;
  title: string;
  description: string;
  location: string;
  scheduledAt: string;
  budgetAmount: number;
}

export interface ApplyInput {
  messageMl?: string;
  proposedPrice?: number;
}

export interface RaiseSafetyReportInput {
  reportedUserId?: string;
  reason: SafetyReportReason;
  severity: SafetyReportSeverity;
  description: string;
  evidenceVaultRefs?: string[];
}

const PLATFORM_FEE_BPS = 1500;

@Injectable()
export class MarketplaceService {
  constructor(
    @Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepository,
    @Inject(GIG_REPOSITORY) private readonly gigs: GigRepository,
    @Inject(APPLICATION_REPOSITORY) private readonly applications: ApplicationRepository,
    @Inject(ASSIGNMENT_REPOSITORY) private readonly assignments: AssignmentRepository,
    @Inject(SAFETY_REPORT_REPOSITORY) private readonly safetyReports: SafetyReportRepository,
    private readonly givers: GiverProfileRepository,
    private readonly verification: VerificationService,
    private readonly audit: AuditService,
    private readonly now: () => number = () => Date.now(),
    private readonly id: () => string = randomId,
    private readonly money?: MoneyService,
  ) {}

  listCategories(): Promise<Category[]> {
    return this.categories.listActive();
  }

  listPricingGuides(): PricingGuide[] {
    return DEFAULT_PRICING_GUIDES;
  }

  async postGig(giverId: string, input: PostGigInput): Promise<Gig> {
    const giver = await this.givers.findByUser(giverId);
    if (!giver || giver.status !== 'active') {
      throw new MarketplaceError('Active giver profile required', 'giver_required');
    }
    if (giver.verificationStatus !== 'approved') {
      throw new MarketplaceError('Giver must complete KYC before posting gigs', 'giver_kyc_required');
    }
    const category = await this.categories.findById(input.categoryId);
    if (!category?.active) {
      throw new MarketplaceError('Active category required', 'category_required');
    }
    if (this.now() > Date.parse(input.scheduledAt)) {
      throw new MarketplaceError('Gig must be scheduled in the future', 'invalid_schedule');
    }
    const review = screenGigRequest(input, pricingGuideFor(input.categoryId));
    const gig: Gig = {
      id: `gig_${this.id()}`,
      giverId,
      categoryId: input.categoryId,
      title: input.title.trim(),
      description: input.description.trim(),
      location: input.location.trim(),
      scheduledAt: new Date(input.scheduledAt).toISOString(),
      budgetAmount: input.budgetAmount,
      currency: 'INR',
      status: 'posted',
      visibilityStatus: review.visibilityStatus,
      riskLevel: review.riskLevel,
      safetyFlags: review.safetyFlags,
      moderatedBy: review.autoModerated ? 'system' : undefined,
      moderatedAt: review.autoModerated ? new Date(this.now()).toISOString() : undefined,
      moderationReason: review.reason,
      createdAt: new Date(this.now()).toISOString(),
    };
    await this.gigs.save(gig);
    this.audit.record({
      actorId: giverId,
      actorRole: 'giver',
      action: gig.visibilityStatus === 'visible' ? 'gig.posted' : 'gig.safety_reviewed',
      targetType: 'gig',
      targetId: gig.id,
      metadata: {
        categoryId: gig.categoryId,
        budgetAmount: gig.budgetAmount,
        visibilityStatus: gig.visibilityStatus,
        riskLevel: gig.riskLevel,
        safetyFlags: gig.safetyFlags,
      },
    });
    return gig;
  }

  listGigs(filters: GigFilters = {}): Promise<Gig[]> {
    return this.gigs.list({ ...filters, visibilityStatus: filters.visibilityStatus ?? 'visible' });
  }

  listGigsForAdmin(filters?: GigFilters): Promise<Gig[]> {
    return this.gigs.list(filters);
  }

  async getGig(gigId: string): Promise<Gig> {
    const gig = await this.gigs.findById(gigId);
    if (!gig) throw new MarketplaceError('Gig not found', 'not_found');
    return gig;
  }

  async apply(gigId: string, workerId: string, input: ApplyInput): Promise<GigApplication> {
    const gig = await this.getGig(gigId);
    if (gig.visibilityStatus !== 'visible') {
      throw new MarketplaceError('Gig is not visible to workers yet', 'gig_not_visible');
    }
    if (gig.status !== 'posted' && gig.status !== 'applied') {
      throw new MarketplaceError('Gig is not accepting applications', 'gig_not_open');
    }
    if (gig.giverId === workerId) {
      throw new MarketplaceError('Giver cannot apply to their own gig', 'own_gig');
    }
    if (!(await this.verification.canApply(workerId))) {
      throw new MarketplaceError('Worker must be verified before applying', 'worker_not_verified');
    }
    const existing = await this.applications.findByGigAndWorker(gigId, workerId);
    if (existing && existing.status !== 'withdrawn') {
      return existing;
    }

    const application: GigApplication = {
      id: existing?.id ?? `app_${this.id()}`,
      gigId,
      workerId,
      messageMl: input.messageMl?.trim(),
      proposedPrice: input.proposedPrice,
      status: 'applied',
      createdAt: existing?.createdAt ?? new Date(this.now()).toISOString(),
    };
    await this.applications.save(application);
    if (gig.status === 'posted') {
      await this.gigs.save({ ...gig, status: 'applied' });
    }
    this.audit.record({
      actorId: workerId,
      actorRole: 'worker',
      action: 'gig.application_submitted',
      targetType: 'gig',
      targetId: gigId,
      metadata: { applicationId: application.id },
    });
    return application;
  }

  async listApplications(gigId: string, giverId: string): Promise<GigApplication[]> {
    const gig = await this.requireGiverGig(gigId, giverId);
    return this.applications.listForGig(gig.id);
  }

  async selectApplicant(
    gigId: string,
    applicationId: string,
    giverId: string,
  ): Promise<{ gig: Gig; assignment: Assignment; applications: GigApplication[] }> {
    const gig = await this.requireGiverGig(gigId, giverId);
    if (gig.status !== 'applied') {
      throw new MarketplaceError('Gig must have applicants before selection', 'invalid_state');
    }
    if (await this.assignments.findByGig(gigId)) {
      throw new MarketplaceError('Gig already has a selected worker', 'already_assigned');
    }
    const selected = await this.applications.findById(applicationId);
    if (!selected || selected.gigId !== gigId || selected.status !== 'applied') {
      throw new MarketplaceError('Application not selectable', 'application_not_selectable');
    }
    const applications = await this.applications.listForGig(gigId);
    const economics = assignmentEconomics(selected.proposedPrice ?? gig.budgetAmount);
    const assignment: Assignment = {
      id: `asg_${this.id()}`,
      gigId,
      workerId: selected.workerId,
      applicationId: selected.id,
      agreedAmount: economics.agreedAmount,
      platformFeeAmount: economics.platformFeeAmount,
      workerPayoutAmount: economics.workerPayoutAmount,
      selectedAt: new Date(this.now()).toISOString(),
    };
    for (const application of applications) {
      await this.applications.save({
        ...application,
        status: application.id === selected.id ? 'selected' : 'rejected',
      });
    }
    await this.assignments.save(assignment);
    if (this.money) {
      await this.money.createEscrowHold({
        gigId,
        assignmentId: assignment.id,
        amount: assignment.agreedAmount,
        actorId: giverId,
      });
    }
    const assignedGig: Gig = { ...gig, status: 'assigned' };
    await this.gigs.save(assignedGig);
    this.audit.record({
      actorId: giverId,
      actorRole: 'giver',
      action: 'gig.worker_selected',
      targetType: 'gig',
      targetId: gigId,
      metadata: {
        applicationId,
        workerId: selected.workerId,
        agreedAmount: assignment.agreedAmount,
        platformFeeAmount: assignment.platformFeeAmount,
        workerPayoutAmount: assignment.workerPayoutAmount,
      },
    });
    return {
      gig: assignedGig,
      assignment,
      applications: await this.applications.listForGig(gigId),
    };
  }

  async moderateGig(
    gigId: string,
    officerId: string,
    decision: 'approve' | 'reject' | 'flag',
    reason: string,
  ): Promise<Gig> {
    const gig = await this.getGig(gigId);
    const visibilityStatus =
      decision === 'approve' ? 'visible' : decision === 'reject' ? 'rejected' : 'flagged';
    const riskLevel = decision === 'approve' && gig.riskLevel === 'high' ? 'medium' : gig.riskLevel;
    const updated: Gig = {
      ...gig,
      visibilityStatus,
      riskLevel,
      moderatedBy: officerId,
      moderatedAt: new Date(this.now()).toISOString(),
      moderationReason: reason,
    };
    await this.gigs.save(updated);
    this.audit.record({
      actorId: officerId,
      actorRole: 'fraud_analyst',
      action: `gig.moderation_${decision}`,
      targetType: 'gig',
      targetId: gigId,
      metadata: {
        previousVisibilityStatus: gig.visibilityStatus,
        visibilityStatus,
        riskLevel,
        safetyFlags: updated.safetyFlags,
      },
    });
    return updated;
  }

  async raiseSafetyReport(
    gigId: string,
    reporterId: string,
    input: RaiseSafetyReportInput,
  ): Promise<SafetyReport> {
    const gig = await this.getGig(gigId);
    const report: SafetyReport = {
      id: `safe_${this.id()}`,
      gigId,
      reporterId,
      reportedUserId: input.reportedUserId,
      reason: input.reason,
      severity: input.severity,
      description: input.description.trim(),
      evidenceVaultRefs: input.evidenceVaultRefs ?? [],
      status: 'open',
      createdAt: new Date(this.now()).toISOString(),
    };
    await this.safetyReports.save(report);

    if (shouldImmediatelyFlag(input.reason, input.severity)) {
      await this.gigs.save({
        ...gig,
        visibilityStatus: 'flagged',
        riskLevel: 'high',
        safetyFlags: [...new Set([...gig.safetyFlags, input.reason])].sort(),
        moderatedBy: 'system',
        moderatedAt: new Date(this.now()).toISOString(),
        moderationReason: 'Automatically flagged after safety report',
      });
    }

    this.audit.record({
      actorId: reporterId,
      actorRole: reporterId === gig.giverId ? 'giver' : 'worker',
      action: 'safety.report_raised',
      targetType: 'safety_report',
      targetId: report.id,
      metadata: {
        gigId,
        reportedUserId: input.reportedUserId,
        reason: input.reason,
        severity: input.severity,
        evidenceCount: report.evidenceVaultRefs.length,
        gigFlagged: shouldImmediatelyFlag(input.reason, input.severity),
      },
    });
    return report;
  }

  listSafetyReports(filters?: { status?: string; gigId?: string }): Promise<SafetyReport[]> {
    return this.safetyReports.list(filters);
  }

  async reviewSafetyReport(
    reportId: string,
    reviewerId: string,
    status: Extract<SafetyReportStatus, 'under_review' | 'action_taken' | 'escalated' | 'closed'>,
    actionTaken: string,
    lawEnforcementRef?: string,
  ): Promise<SafetyReport> {
    const report = await this.safetyReports.findById(reportId);
    if (!report) throw new MarketplaceError('Safety report not found', 'not_found');
    const updated: SafetyReport = {
      ...report,
      status,
      actionTaken: actionTaken.trim(),
      reviewedBy: reviewerId,
      reviewedAt: new Date(this.now()).toISOString(),
      lawEnforcementRef,
    };
    await this.safetyReports.save(updated);
    this.audit.record({
      actorId: reviewerId,
      actorRole: 'fraud_analyst',
      action: `safety.report_${status}`,
      targetType: 'safety_report',
      targetId: reportId,
      metadata: {
        gigId: report.gigId,
        reason: report.reason,
        severity: report.severity,
        lawEnforcementRef: lawEnforcementRef ? '[recorded]' : undefined,
      },
    });
    return updated;
  }

  async transitionGig(gigId: string, actorId: string, next: Extract<GigStatus, 'in_progress' | 'completed' | 'cancelled'>): Promise<Gig> {
    const gig = await this.getGig(gigId);
    const assignment = await this.assignments.findByGig(gigId);
    if (!assignment) throw new MarketplaceError('Gig has no assignment', 'not_assigned');

    if (next === 'in_progress') {
      if (actorId !== assignment.workerId) {
        throw new MarketplaceError('Only selected worker can start the gig', 'forbidden');
      }
      if (gig.status !== 'assigned') {
        throw new MarketplaceError('Only assigned gigs can start', 'invalid_state');
      }
    }
    if (next === 'completed') {
      if (actorId !== gig.giverId) {
        throw new MarketplaceError('Only giver can confirm completion', 'forbidden');
      }
      if (gig.status !== 'in_progress') {
        throw new MarketplaceError('Only in-progress gigs can complete', 'invalid_state');
      }
    }
    if (next === 'cancelled' && actorId !== gig.giverId && actorId !== assignment.workerId) {
      throw new MarketplaceError('Only gig parties can cancel before money is enabled', 'forbidden');
    }
    if (next === 'cancelled' && gig.status === 'completed') {
      throw new MarketplaceError('Completed gigs cannot be cancelled', 'invalid_state');
    }
    if (next === 'cancelled' && gig.status === 'cancelled') {
      throw new MarketplaceError('Gig is already cancelled', 'invalid_state');
    }

    const updated = { ...gig, status: next };
    await this.gigs.save(updated);
    if (next === 'completed' && this.money) {
      await this.money.releaseEscrow({
        gigId,
        assignmentId: assignment.id,
        workerId: assignment.workerId,
        agreedAmount: assignment.agreedAmount,
        platformFeeAmount: assignment.platformFeeAmount,
        workerPayoutAmount: assignment.workerPayoutAmount,
        actorId,
      });
    }
    if (next === 'cancelled' && this.money) {
      await this.money.refundEscrow({
        gigId,
        assignmentId: assignment.id,
        amount: assignment.agreedAmount,
        actorId,
        actorRole: actorId === gig.giverId ? 'giver' : 'worker',
      });
    }
    this.audit.record({
      actorId,
      actorRole: actorId === gig.giverId ? 'giver' : 'worker',
      action: `gig.${next}`,
      targetType: 'gig',
      targetId: gigId,
    });
    return updated;
  }

  private async requireGiverGig(gigId: string, giverId: string): Promise<Gig> {
    const gig = await this.getGig(gigId);
    if (gig.giverId !== giverId) {
      throw new MarketplaceError('Only the giver can manage this gig', 'forbidden');
    }
    return gig;
  }
}

function randomId(): string {
  return randomBytes(10).toString('hex');
}

function pricingGuideFor(categoryId: string): PricingGuide | undefined {
  return DEFAULT_PRICING_GUIDES.find((guide) => guide.categoryId === categoryId);
}

function assignmentEconomics(agreedAmount: number): Pick<
  Assignment,
  'agreedAmount' | 'platformFeeAmount' | 'workerPayoutAmount'
> {
  const platformFeeAmount = Math.round((agreedAmount * PLATFORM_FEE_BPS) / 10_000);
  return {
    agreedAmount,
    platformFeeAmount,
    workerPayoutAmount: agreedAmount - platformFeeAmount,
  };
}

function screenGigRequest(input: PostGigInput, pricingGuide?: PricingGuide): {
  visibilityStatus: Gig['visibilityStatus'];
  riskLevel: Gig['riskLevel'];
  safetyFlags: string[];
  autoModerated: boolean;
  reason?: string;
} {
  const text = `${input.title} ${input.description} ${input.location}`.toLowerCase();
  const flags = new Set<string>();

  flagWhen(text, flags, 'illegal_request', [
    'illegal',
    'fake id',
    'forged',
    'weapon',
    'gun',
    'knife fight',
    'drug',
  ]);
  flagWhen(text, flags, 'sexual_or_exploitative', [
    'sexual',
    'massage alone',
    'adult service',
    'escort',
    'private service',
  ]);
  flagWhen(text, flags, 'unsafe_or_isolating', [
    'come alone',
    'secret location',
    'late night alone',
    'no questions',
  ]);
  flagWhen(text, flags, 'off_platform_payment', [
    'pay outside',
    'direct payment',
    'avoid app',
    'cash only no app',
  ]);
  flagWhen(text, flags, 'minor_or_medical_risk', [
    'child care overnight',
    'minor',
    'injection',
    'medicine',
    'nurse',
  ]);

  if (pricingGuide && input.budgetAmount < pricingGuide.minBudgetAmount) {
    flags.add('budget_below_fair_minimum');
  }
  if (pricingGuide && input.budgetAmount > pricingGuide.highReviewAmount) {
    flags.add('budget_unusually_high');
  }
  if (!pricingGuide && input.budgetAmount < 100) flags.add('budget_too_low');
  if (!pricingGuide && input.budgetAmount > 100000) flags.add('budget_unusually_high');
  if (input.description.trim().length < 20) flags.add('description_too_vague');

  const safetyFlags = [...flags].sort();
  const hardBlock = safetyFlags.some((flag) =>
    ['illegal_request', 'sexual_or_exploitative'].includes(flag),
  );
  if (hardBlock) {
    return {
      visibilityStatus: 'rejected',
      riskLevel: 'high',
      safetyFlags,
      autoModerated: true,
      reason: 'Automatically rejected by gig safety policy',
    };
  }
  if (safetyFlags.length) {
    return {
      visibilityStatus: 'pending_review',
      riskLevel: 'medium',
      safetyFlags,
      autoModerated: false,
    };
  }
  return {
    visibilityStatus: 'visible',
    riskLevel: 'low',
    safetyFlags,
    autoModerated: true,
    reason: 'Automatically approved by low-risk safety screen',
  };
}

function flagWhen(text: string, flags: Set<string>, flag: string, patterns: string[]): void {
  if (patterns.some((pattern) => text.includes(pattern))) flags.add(flag);
}

function shouldImmediatelyFlag(reason: SafetyReportReason, severity: SafetyReportSeverity): boolean {
  return (
    severity === 'critical' ||
    severity === 'high' ||
    ['sexual_misconduct', 'drugs_or_illegal_activity', 'violence_or_threat'].includes(reason)
  );
}
