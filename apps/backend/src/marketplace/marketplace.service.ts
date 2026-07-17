import { createHash, randomBytes } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { AuditService } from '../common/audit/audit.service';
import { GiverProfileRepository, UserRepository } from '../identity/identity.repository';
import { GigMoneyTrail, MoneyService } from '../money/money.service';
import { VerificationService } from '../verification/verification.service';
import {
  Assignment,
  Category,
  DEFAULT_PRICING_GUIDES,
  EscalationPackageManifest,
  EvidenceVaultRef,
  Gig,
  GigApplication,
  GigStatus,
  PricingGuide,
  Rating,
  RatingDirection,
  SafetyReport,
  SafetyReportReason,
  SafetyReportSeverity,
  SafetyReportStatus,
} from './marketplace.entities';
import {
  APPLICATION_REPOSITORY,
  ASSIGNMENT_REPOSITORY,
  EVIDENCE_VAULT_REF_REPOSITORY,
  RATING_REPOSITORY,
  SAFETY_REPORT_REPOSITORY,
  ApplicationRepository,
  AssignmentRepository,
  CATEGORY_REPOSITORY,
  CategoryRepository,
  EvidenceVaultRefRepository,
  ESCALATION_PACKAGE_REPOSITORY,
  EscalationPackageRepository,
  GIG_REPOSITORY,
  GigFilters,
  GigRepository,
  PROPOSAL_TOKEN_REPOSITORY,
  ProposalTokenRepository,
  RatingRepository,
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

export interface RateGigInput {
  stars: number;
  tags?: string[];
  comment?: string;
}

export interface RaiseSafetyReportInput {
  reportedUserId?: string;
  reason: SafetyReportReason;
  severity: SafetyReportSeverity;
  description: string;
  evidenceVaultRefs?: string[];
}

export type DisputeResolutionOutcome = 'release_to_worker' | 'refund_giver' | 'keep_escalated';

export interface AdminDecisionNote {
  reasonCode: string;
  note: string;
}

export type AdminDecisionReasonAction =
  | 'category.activate'
  | 'category.deactivate'
  | 'gig.approve'
  | 'gig.reject'
  | 'gig.flag'
  | 'safety.under_review'
  | 'safety.action_taken'
  | 'safety.escalated'
  | 'safety.closed'
  | 'dispute.release_to_worker'
  | 'dispute.refund_giver'
  | 'dispute.keep_escalated'
  | 'escalation.generate'
  | 'giver.deactivate_abusive'
  | 'worker.suspend_abusive'
  | 'proposal_tokens.grant';

export interface AdminDecisionReason {
  code: string;
  label: string;
  requiresLawEnforcementRef?: boolean;
}

export interface OperatorPolicyMatrixEntry {
  area: 'gig_review' | 'safety_case' | 'lawful_escalation' | 'account_action' | 'money_dispute';
  trigger: string;
  adminAction: AdminDecisionReasonAction;
  severity: 'low' | 'medium' | 'high' | 'critical';
  requiredEvidence: string[];
  decisionRule: string;
  userProtection: string;
  escalationPath: string;
}

export const ADMIN_DECISION_REASON_CATALOG: Record<
  AdminDecisionReasonAction,
  AdminDecisionReason[]
> = {
  'category.activate': [
    { code: 'category_launch_ready', label: 'Category is ready for launch' },
    { code: 'category_safety_review_complete', label: 'Category safety review is complete' },
  ],
  'category.deactivate': [
    { code: 'category_safety_pause', label: 'Pause category for safety review' },
    { code: 'category_operations_pause', label: 'Pause category for operations review' },
    { code: 'category_pricing_review', label: 'Pause category for pricing review' },
  ],
  'gig.approve': [
    { code: 'caller_verified_scope', label: 'Caller verified safe scope' },
    { code: 'pricing_and_location_reasonable', label: 'Pricing and location are reasonable' },
    { code: 'false_positive_safety_flag', label: 'Safety flag was a false positive' },
  ],
  'gig.reject': [
    { code: 'unsafe_or_exploitative_request', label: 'Unsafe or exploitative request' },
    { code: 'illegal_or_prohibited_request', label: 'Illegal or prohibited request' },
    { code: 'insufficient_safe_scope', label: 'Insufficient safe scope' },
  ],
  'gig.flag': [
    { code: 'needs_safety_followup', label: 'Needs safety follow-up' },
    { code: 'suspicious_location_or_timing', label: 'Suspicious location or timing' },
    { code: 'possible_off_platform_or_fraud', label: 'Possible off-platform payment or fraud' },
  ],
  'safety.under_review': [
    { code: 'triage_started', label: 'Triage started' },
    { code: 'awaiting_evidence_review', label: 'Awaiting evidence review' },
  ],
  'safety.action_taken': [
    { code: 'platform_action_completed', label: 'Platform action completed' },
    { code: 'party_warned_or_restricted', label: 'Party warned or restricted' },
    { code: 'case_resolved_without_police', label: 'Case resolved without police escalation' },
  ],
  'safety.escalated': [
    {
      code: 'lawful_police_escalation',
      label: 'Lawful police escalation',
      requiresLawEnforcementRef: true,
    },
    { code: 'severe_safety_risk', label: 'Severe safety risk' },
  ],
  'safety.closed': [
    { code: 'insufficient_evidence', label: 'Insufficient evidence' },
    { code: 'duplicate_or_withdrawn_report', label: 'Duplicate or withdrawn report' },
    { code: 'resolved_after_followup', label: 'Resolved after follow-up' },
  ],
  'dispute.release_to_worker': [
    { code: 'evidence_supports_worker_payment', label: 'Evidence supports worker payment' },
    { code: 'giver_fault_or_no_show', label: 'Giver fault or no-show' },
  ],
  'dispute.refund_giver': [
    { code: 'evidence_supports_giver_refund', label: 'Evidence supports giver refund' },
    { code: 'worker_fault_or_no_show', label: 'Worker fault or no-show' },
  ],
  'dispute.keep_escalated': [
    { code: 'awaiting_more_evidence', label: 'Awaiting more evidence' },
    { code: 'law_enforcement_pending', label: 'Law enforcement pending' },
  ],
  'escalation.generate': [
    { code: 'police_escalation_ready', label: 'Police escalation package ready' },
    { code: 'legal_hold_package_ready', label: 'Legal hold package ready' },
  ],
  'giver.deactivate_abusive': [
    { code: 'worker_safety_risk', label: 'Worker safety risk' },
    { code: 'repeated_or_severe_abuse', label: 'Repeated or severe abuse' },
    { code: 'illegal_or_criminal_activity', label: 'Illegal or criminal activity' },
  ],
  'worker.suspend_abusive': [
    { code: 'giver_safety_risk', label: 'Giver safety risk' },
    { code: 'repeated_or_severe_abuse', label: 'Repeated or severe abuse' },
    { code: 'illegal_or_criminal_activity', label: 'Illegal or criminal activity' },
    { code: 'fraud_or_theft_risk', label: 'Fraud or theft risk' },
  ],
  'proposal_tokens.grant': [
    { code: 'support_adjustment', label: 'Support adjustment' },
    { code: 'launch_promo', label: 'Launch promo' },
    { code: 'payment_reconciliation', label: 'Payment reconciliation' },
  ],
};

export const OPERATOR_POLICY_MATRIX: OperatorPolicyMatrixEntry[] = [
  {
    area: 'gig_review',
    trigger: 'Normal gig with clear legal scope, verified giver, sane budget, location, and timing.',
    adminAction: 'gig.approve',
    severity: 'low',
    requiredEvidence: ['Giver KYC approved', 'Category allowed', 'Budget within pricing guide', 'Location and time are reasonable'],
    decisionRule: 'Approve only when the work is lawful, specific, priced fairly, and safe for a worker to accept.',
    userProtection: 'Worker sees a vetted gig; giver can receive applicants without unnecessary delay.',
    escalationPath: 'No escalation; keep audit note concise.',
  },
  {
    area: 'gig_review',
    trigger: 'Sexual favors, drugs, violence, weapon handling, illegal transport, explicit criminal help, or exploitative work.',
    adminAction: 'gig.reject',
    severity: 'critical',
    requiredEvidence: ['Original gig text', 'Safety flags', 'Giver identity status', 'Any attached evidence refs'],
    decisionRule: 'Reject immediately. Do not edit the request into a safer version on behalf of the giver.',
    userProtection: 'Prevents unsafe or criminal work from reaching workers.',
    escalationPath: 'If credible imminent harm or criminal intent exists, open/escalate a safety case and prepare lawful escalation package.',
  },
  {
    area: 'gig_review',
    trigger: 'Ambiguous work scope, suspicious timing/location, possible off-platform payment, or unusually low/high budget.',
    adminAction: 'gig.flag',
    severity: 'medium',
    requiredEvidence: ['Gig text', 'Pricing guardrail', 'Giver history', 'Location and schedule context'],
    decisionRule: 'Flag instead of approving when a reasonable operator cannot explain why the gig is safe.',
    userProtection: 'Keeps workers away until ops clarifies the risk.',
    escalationPath: 'Request clarification or require giver re-verification for repeated suspicious patterns.',
  },
  {
    area: 'safety_case',
    trigger: 'Worker or giver reports harassment, unsafe location, fraud, no-show, coercion, threats, or suspicious behavior.',
    adminAction: 'safety.under_review',
    severity: 'high',
    requiredEvidence: ['Report reason and severity', 'Reporter identity', 'Gig audit trail', 'Evidence vault refs if provided'],
    decisionRule: 'Move to under review quickly, preserve refs, and avoid exposing reporter details to the other party.',
    userProtection: 'Signals that Heydo is actively protecting the reporting user while preserving due process.',
    escalationPath: 'High or critical cases need second-reviewer discipline before irreversible action.',
  },
  {
    area: 'account_action',
    trigger: 'Credible severe or repeated abuse by a gig giver, including sexual misconduct, illegal requests, threats, or retaliation.',
    adminAction: 'giver.deactivate_abusive',
    severity: 'critical',
    requiredEvidence: ['Safety report', 'Gig history', 'Open gig list', 'Decision note', 'Reporter safety context'],
    decisionRule: 'Deactivate when continued access creates risk to workers or evidence indicates severe abuse.',
    userProtection: 'Quarantines open gigs and prevents further worker exposure.',
    escalationPath: 'If criminal or imminent-harm indicators exist, mark safety case escalated and generate lawful escalation package.',
  },
  {
    area: 'account_action',
    trigger: 'Credible severe or repeated abuse by a worker, including violence, theft/fraud, harassment, or unsafe conduct.',
    adminAction: 'worker.suspend_abusive',
    severity: 'critical',
    requiredEvidence: ['Safety report', 'Application/assignment history', 'Giver safety context', 'Evidence refs if available'],
    decisionRule: 'Suspend when continued access creates risk to givers, households, or the platform.',
    userProtection: 'Withdraws pending applications and prevents risky assignments while review continues.',
    escalationPath: 'If criminal or imminent-harm indicators exist, mark safety case escalated and generate lawful escalation package.',
  },
  {
    area: 'lawful_escalation',
    trigger: 'Credible criminal activity, imminent harm, violence/threat, sexual misconduct, drugs/illegal activity, or police/legal request.',
    adminAction: 'escalation.generate',
    severity: 'critical',
    requiredEvidence: ['Serious safety report', 'Evidence vault refs only', 'Gig audit trail', 'Money trail when relevant', 'Second reviewer'],
    decisionRule: 'Generate packages only for serious cases with lawful purpose. Never include raw Aadhaar/selfie data in the package.',
    userProtection: 'Allows cooperation with authorities while minimizing PII exposure.',
    escalationPath: 'Record law enforcement reference where required and keep legal hold active.',
  },
  {
    area: 'money_dispute',
    trigger: 'Completion, no-show, unsafe cancellation, fraud allegation, or dispute affecting escrow release/refund.',
    adminAction: 'dispute.keep_escalated',
    severity: 'high',
    requiredEvidence: ['Assignment state', 'Completion evidence', 'Safety report if any', 'Money trail', 'Both-party notes'],
    decisionRule: 'Keep escalated when evidence is incomplete or safety risk intersects with money release.',
    userProtection: 'Avoids paying the wrong party or pressuring a harmed user to close a case.',
    escalationPath: 'Resolve to worker/refund only after evidence supports the action and audit is healthy.',
  },
];

export interface SafetyEscalationPackage {
  id: string;
  generatedAt: string;
  generatedBy: string;
  purpose: 'lawful_safety_escalation';
  report: SafetyReport;
  gig: Gig;
  assignment: Assignment | null;
  manifest: EscalationPackageManifest;
  evidenceVaultRefs: string[];
  integrity: {
    algorithm: 'sha256';
    snapshotSchemaVersion: number;
    snapshotHash: string;
    verified: boolean;
    verifiedAt: string;
  };
  auditTrail: Awaited<ReturnType<AuditService['list']>>;
  moneyTrail: GigMoneyTrail | null;
  piiPolicy: {
    rawAadhaarStored: false;
    rawSelfieIncluded: false;
    evidenceRefsOnly: true;
  };
}

export interface WorkerGigApplicationView {
  application: GigApplication;
  gig: Gig;
  assignment: Assignment | null;
}

export interface ReputationSignalSummary {
  direction: RatingDirection;
  averageStars: number | null;
  ratingCount: number;
  heydoScore: number | null;
}

export interface ReputationSummary {
  userId: string;
  asWorker: ReputationSignalSummary;
  asGiver: ReputationSignalSummary;
}

export interface RatingReviewItem {
  rating: Omit<Rating, 'comment'> & { commentLength: number };
  gig: Gig;
  rateeReputation: ReputationSummary;
}

export interface MarketplaceEconomicsSummary {
  commissionBps: number;
  proposalTokenUnitPriceAmount: number;
  assignmentCount: number;
  completedGigCount: number;
  grossBookingValueAmount: number;
  platformFeeAmount: number;
  workerPayoutAmount: number;
  proposalTokenCount: number;
  modeledProposalTokenRevenueAmount: number;
  pendingReviewGigCount: number;
}

export interface AdminCategoryView extends Category {
  pricingGuide?: PricingGuide;
  totalGigCount: number;
  openGigCount: number;
  visibleGigCount: number;
  pendingReviewGigCount: number;
}

export interface MarketplaceHealthSummary {
  generatedAt: string;
  totalCategoryCount: number;
  activeCategoryCount: number;
  inactiveCategoryCount: number;
  categoriesMissingPricingGuideCount: number;
  totalGigCount: number;
  openGigCount: number;
  visibleGigCount: number;
  pendingReviewGigCount: number;
  flaggedGigCount: number;
  rejectedGigCount: number;
  openSafetyReportCount: number;
  highSeverityOpenSafetyReportCount: number;
}

export interface ProposalTokenPolicy {
  priceStepAmount: number;
  tokenUnitPriceAmount: number;
  currency: 'INR';
}

type ReportedUserRole = 'giver' | 'worker' | 'unknown';

interface AdminSafetyReportContext {
  reportedUserRole: ReportedUserRole;
  reportedUserStatus?: string;
  reportedUserVerificationStatus?: string;
  reportedUserReportCount: number;
  reportedUserHighSeverityReportCount: number;
}

export interface AdminGigReviewContext {
  categoryNameEn?: string;
  pricingGuide?: PricingGuide;
  pricingAssessment: 'below_fair_minimum' | 'within_guardrail' | 'above_high_review' | 'missing_guide';
}

const PLATFORM_FEE_BPS = 1500;
const NEGOTIATION_TOKEN_PRICE_STEP = 500;
const PROPOSAL_TOKEN_UNIT_PRICE_AMOUNT = 10;
const STARTER_PROPOSAL_TOKEN_BALANCE = 5;
const MAX_ADMIN_PROPOSAL_TOKEN_GRANT = 100;
const ESCALATION_SNAPSHOT_SCHEMA_VERSION = 1;
const ADMIN_ACTION_LIMITS = {
  evidence_refs_accessed: { max: 5, windowMs: 60_000 },
  dispute_resolution: { max: 3, windowMs: 5 * 60_000 },
  escalation_package_generated: { max: 3, windowMs: 5 * 60_000 },
} as const;

type AdminThrottledAction = keyof typeof ADMIN_ACTION_LIMITS;

@Injectable()
export class MarketplaceService {
  private readonly adminActionAttempts = new Map<string, number[]>();

  constructor(
    @Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepository,
    @Inject(GIG_REPOSITORY) private readonly gigs: GigRepository,
    @Inject(APPLICATION_REPOSITORY) private readonly applications: ApplicationRepository,
    @Inject(ASSIGNMENT_REPOSITORY) private readonly assignments: AssignmentRepository,
    @Inject(PROPOSAL_TOKEN_REPOSITORY) private readonly proposalTokens: ProposalTokenRepository,
    @Inject(RATING_REPOSITORY) private readonly ratings: RatingRepository,
    @Inject(SAFETY_REPORT_REPOSITORY) private readonly safetyReports: SafetyReportRepository,
    @Inject(EVIDENCE_VAULT_REF_REPOSITORY)
    private readonly evidenceVaultRefs: EvidenceVaultRefRepository,
    @Inject(ESCALATION_PACKAGE_REPOSITORY)
    private readonly escalationPackages: EscalationPackageRepository,
    private readonly users: UserRepository,
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

  async listCategoriesForAdmin(): Promise<AdminCategoryView[]> {
    const [categories, gigs] = await Promise.all([this.categories.listAll(), this.gigs.list()]);
    return categories.map((category) => {
      const categoryGigs = gigs.filter((gig) => gig.categoryId === category.id);
      return {
        ...category,
        pricingGuide: pricingGuideFor(category.id),
        totalGigCount: categoryGigs.length,
        openGigCount: categoryGigs.filter((gig) => !['completed', 'cancelled'].includes(gig.status)).length,
        visibleGigCount: categoryGigs.filter((gig) => gig.visibilityStatus === 'visible').length,
        pendingReviewGigCount: categoryGigs.filter(
          (gig) => gig.visibilityStatus === 'pending_review',
        ).length,
      };
    });
  }

  async setCategoryActive(
    categoryId: string,
    active: boolean,
    adminId: string,
    decisionNote: AdminDecisionNote,
  ): Promise<AdminCategoryView> {
    const category = await this.categories.findById(categoryId);
    if (!category) {
      throw new MarketplaceError('Category not found', 'not_found');
    }
    if (category.active !== active) {
      await this.categories.save({ ...category, active });
      const gigs = await this.gigs.list({ categoryId });
      this.audit.record({
        actorId: adminId,
        actorRole: 'fraud_analyst',
        action: active ? 'marketplace.category_activated' : 'marketplace.category_deactivated',
        targetType: 'category',
        targetId: categoryId,
        metadata: {
          previousActive: category.active,
          active,
          openGigCount: gigs.filter((gig) => !['completed', 'cancelled'].includes(gig.status)).length,
          decision: summarizeDecision(
            decisionNote,
            active ? 'Category activated by admin' : 'Category deactivated by admin',
          ),
        },
      });
    }
    const categories = await this.listCategoriesForAdmin();
    return categories.find((item) => item.id === categoryId)!;
  }

  async marketplaceHealthForAdmin(): Promise<MarketplaceHealthSummary> {
    const [categories, gigs, safetyReports] = await Promise.all([
      this.categories.listAll(),
      this.gigs.list(),
      this.safetyReports.list(),
    ]);
    const openSafetyReports = safetyReports.filter((report) => report.status !== 'closed');
    return {
      generatedAt: new Date(this.now()).toISOString(),
      totalCategoryCount: categories.length,
      activeCategoryCount: categories.filter((category) => category.active).length,
      inactiveCategoryCount: categories.filter((category) => !category.active).length,
      categoriesMissingPricingGuideCount: categories.filter(
        (category) => !pricingGuideFor(category.id),
      ).length,
      totalGigCount: gigs.length,
      openGigCount: gigs.filter((gig) => !['completed', 'cancelled'].includes(gig.status)).length,
      visibleGigCount: gigs.filter((gig) => gig.visibilityStatus === 'visible').length,
      pendingReviewGigCount: gigs.filter((gig) => gig.visibilityStatus === 'pending_review').length,
      flaggedGigCount: gigs.filter((gig) => gig.visibilityStatus === 'flagged').length,
      rejectedGigCount: gigs.filter((gig) => gig.visibilityStatus === 'rejected').length,
      openSafetyReportCount: openSafetyReports.length,
      highSeverityOpenSafetyReportCount: openSafetyReports.filter((report) =>
        ['high', 'critical'].includes(report.severity),
      ).length,
    };
  }

  listPricingGuides(): PricingGuide[] {
    return DEFAULT_PRICING_GUIDES;
  }

  proposalTokenPolicy(): ProposalTokenPolicy {
    return {
      priceStepAmount: NEGOTIATION_TOKEN_PRICE_STEP,
      tokenUnitPriceAmount: PROPOSAL_TOKEN_UNIT_PRICE_AMOUNT,
      currency: 'INR',
    };
  }

  async proposalTokenBalance(workerId: string) {
    return this.proposalTokens.ensureAccount(
      workerId,
      STARTER_PROPOSAL_TOKEN_BALANCE,
      new Date(this.now()).toISOString(),
    );
  }

  async grantProposalTokens(
    workerId: string,
    amount: number,
    adminId: string,
    decisionNote: AdminDecisionNote,
  ) {
    if (!Number.isInteger(amount) || amount < 1 || amount > MAX_ADMIN_PROPOSAL_TOKEN_GRANT) {
      throw new MarketplaceError('Proposal token grant amount is invalid', 'invalid_token_grant');
    }
    const worker = await this.users.findById(workerId);
    if (!worker || !worker.roles.includes('worker')) {
      throw new MarketplaceError('Worker account not found', 'not_found');
    }
    await this.proposalTokens.ensureAccount(
      workerId,
      STARTER_PROPOSAL_TOKEN_BALANCE,
      new Date(this.now()).toISOString(),
    );
    const account = await this.proposalTokens.credit(workerId, amount, new Date(this.now()).toISOString());
    this.audit.record({
      actorId: adminId,
      actorRole: 'finance',
      action: 'proposal_tokens.granted',
      targetType: 'worker',
      targetId: workerId,
      metadata: {
        amount,
        balanceAfter: account.balance,
        modeledValueAmount: amount * PROPOSAL_TOKEN_UNIT_PRICE_AMOUNT,
        decision: summarizeDecision(decisionNote, 'Proposal tokens granted by admin'),
      },
    });
    return account;
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

  async listGigsForAdmin(filters?: GigFilters): Promise<Array<Gig & AdminGigReviewContext>> {
    const gigs = await this.gigs.list(filters);
    return Promise.all(
      gigs.map(async (gig) => ({
        ...gig,
        ...(await this.buildAdminGigReviewContext(gig)),
      })),
    );
  }

  async marketplaceEconomicsForAdmin(): Promise<MarketplaceEconomicsSummary> {
    const gigs = await this.gigs.list();
    const rows = await Promise.all(
      gigs.map(async (gig) => {
        const [assignment, applications] = await Promise.all([
          this.assignments.findByGig(gig.id),
          this.applications.listForGig(gig.id),
        ]);
        return { gig, assignment, applications };
      }),
    );
    const assignments = rows
      .map((row) => row.assignment)
      .filter((assignment): assignment is Assignment => Boolean(assignment));
    const proposalTokenCount = rows.reduce(
      (sum, row) =>
        sum +
        row.applications.reduce(
          (applicationSum, application) => applicationSum + application.negotiationTokenCost,
          0,
        ),
      0,
    );
    return {
      commissionBps: PLATFORM_FEE_BPS,
      proposalTokenUnitPriceAmount: PROPOSAL_TOKEN_UNIT_PRICE_AMOUNT,
      assignmentCount: assignments.length,
      completedGigCount: rows.filter((row) => row.gig.status === 'completed').length,
      grossBookingValueAmount: assignments.reduce((sum, assignment) => sum + assignment.agreedAmount, 0),
      platformFeeAmount: assignments.reduce((sum, assignment) => sum + assignment.platformFeeAmount, 0),
      workerPayoutAmount: assignments.reduce((sum, assignment) => sum + assignment.workerPayoutAmount, 0),
      proposalTokenCount,
      modeledProposalTokenRevenueAmount: proposalTokenCount * PROPOSAL_TOKEN_UNIT_PRICE_AMOUNT,
      pendingReviewGigCount: rows.filter((row) => row.gig.visibilityStatus === 'pending_review').length,
    };
  }

  private async buildAdminGigReviewContext(gig: Gig): Promise<AdminGigReviewContext> {
    const [category, pricingGuide] = await Promise.all([
      this.categories.findById(gig.categoryId),
      Promise.resolve(pricingGuideFor(gig.categoryId)),
    ]);
    if (!pricingGuide) {
      return {
        categoryNameEn: category?.nameEn,
        pricingAssessment: 'missing_guide',
      };
    }
    const pricingAssessment =
      gig.budgetAmount < pricingGuide.minBudgetAmount
        ? 'below_fair_minimum'
        : gig.budgetAmount > pricingGuide.highReviewAmount
          ? 'above_high_review'
          : 'within_guardrail';
    return {
      categoryNameEn: category?.nameEn,
      pricingGuide,
      pricingAssessment,
    };
  }

  listGiverGigs(giverId: string): Promise<Gig[]> {
    return this.gigs.list({ giverId });
  }

  async listWorkerApplications(workerId: string): Promise<WorkerGigApplicationView[]> {
    const applications = await this.applications.listForWorker(workerId);
    const views = await Promise.all(
      applications.map(async (application) => {
        const gig = await this.getGig(application.gigId);
        const assignment =
          application.status === 'selected' ? await this.assignments.findByGig(gig.id) : null;
        return { application, gig, assignment };
      }),
    );
    return views;
  }

  listRatingsForGig(gigId: string): Promise<Rating[]> {
    return this.ratings.listForGig(gigId);
  }

  async reputationForUser(userId: string): Promise<ReputationSummary> {
    const [asWorkerRatings, asGiverRatings] = await Promise.all([
      this.ratings.listForRatee(userId, 'giver_to_worker'),
      this.ratings.listForRatee(userId, 'worker_to_giver'),
    ]);
    return {
      userId,
      asWorker: reputationSignal('giver_to_worker', asWorkerRatings),
      asGiver: reputationSignal('worker_to_giver', asGiverRatings),
    };
  }

  async listLowRatingReviewItems(maxStars = 2): Promise<RatingReviewItem[]> {
    const [ratings, reports] = await Promise.all([
      this.ratings.listAtOrBelowStars(maxStars),
      this.safetyReports.list(),
    ]);
    const convertedRatingRefs = new Set(
      reports.flatMap((report) =>
        report.evidenceVaultRefs.filter((ref) => ref.startsWith('rating:')),
      ),
    );
    return Promise.all(
      ratings
        .filter((rating) => !convertedRatingRefs.has(`rating:${rating.id}`))
        .map(async (rating) => ({
          rating: ratingReviewSummary(rating),
          gig: await this.getGig(rating.gigId),
          rateeReputation: await this.reputationForUser(rating.rateeId),
        })),
    );
  }

  async openSafetyReportFromRating(
    gigId: string,
    direction: RatingDirection,
    officerId: string,
    note: string,
  ): Promise<SafetyReport> {
    const rating = await this.ratings.findByGigAndDirection(gigId, direction);
    if (!rating || rating.stars > 2) {
      throw new MarketplaceError('Low rating not found for safety conversion', 'not_found');
    }
    const ratingEvidenceRef = `rating:${rating.id}`;
    const existingReport = (await this.safetyReports.list({ gigId })).find((report) =>
      report.evidenceVaultRefs.includes(ratingEvidenceRef),
    );
    if (existingReport) return existingReport;

    const reason = safetyReasonForRating(rating);
    const report = await this.raiseSafetyReport(gigId, officerId, {
      reportedUserId: rating.rateeId,
      reason,
      severity: rating.stars <= 1 ? 'high' : 'medium',
      description: `Admin converted low rating ${rating.id} into a safety review: ${note.trim()}`,
      evidenceVaultRefs: [ratingEvidenceRef],
    });
    this.audit.record({
      actorId: officerId,
      actorRole: 'fraud_analyst',
      action: 'admin.low_rating_safety_report_opened',
      targetType: 'safety_report',
      targetId: report.id,
      metadata: {
        gigId,
        ratingId: rating.id,
        direction: rating.direction,
        stars: rating.stars,
        reportedUserId: rating.rateeId,
        reason,
      },
    });
    return report;
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

    const proposedPrice = input.proposedPrice;
    const tokenQuote = quoteNegotiationTokens(gig.budgetAmount, proposedPrice);
    const tokenAccount = await this.proposalTokens.ensureAccount(
      workerId,
      STARTER_PROPOSAL_TOKEN_BALANCE,
      new Date(this.now()).toISOString(),
    );
    if (tokenAccount.balance < tokenQuote.negotiationTokenCost) {
      throw new MarketplaceError('Not enough proposal tokens for this counter-rate', 'proposal_tokens_required');
    }
    const debitedAccount =
      tokenQuote.negotiationTokenCost > 0
        ? await this.proposalTokens.debit(
            workerId,
            tokenQuote.negotiationTokenCost,
            new Date(this.now()).toISOString(),
          )
        : tokenAccount;
    if (!debitedAccount) {
      throw new MarketplaceError('Not enough proposal tokens for this counter-rate', 'proposal_tokens_required');
    }
    const application: GigApplication = {
      id: existing?.id ?? `app_${this.id()}`,
      gigId,
      workerId,
      messageMl: input.messageMl?.trim(),
      proposedPrice,
      priceDeltaAmount: tokenQuote.priceDeltaAmount,
      negotiationTokenCost: tokenQuote.negotiationTokenCost,
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
      metadata: {
        applicationId: application.id,
        proposedPrice: application.proposedPrice,
        priceDeltaAmount: application.priceDeltaAmount,
        negotiationTokenCost: application.negotiationTokenCost,
        proposalTokenBalanceAfter: debitedAccount.balance,
      },
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
    decisionNote?: AdminDecisionNote,
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
        decision: summarizeDecision(decisionNote, reason),
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
    await this.registerEvidenceRefs(report);

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
      const assignment = await this.assignments.findByGig(gigId);
      if (this.money && assignment && ['assigned', 'in_progress'].includes(gig.status)) {
        await this.money.openEscrowDispute({
          gigId,
          assignmentId: assignment.id,
          reportId: report.id,
          actorId: reporterId,
          actorRole: reporterId === gig.giverId ? 'giver' : 'worker',
          reason: input.reason,
        });
      }
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

  async listSafetyReportEvidenceRefs(
    reportId: string,
    actorId: string,
    actorRoles: string[],
  ): Promise<EvidenceVaultRef[]> {
    const report = await this.safetyReports.findById(reportId);
    if (!report) throw new MarketplaceError('Safety report not found', 'not_found');
    const refs = await this.evidenceVaultRefs.listForReport(reportId);
    const allowed = refs.filter((ref) =>
      ref.allowedRoles.some((role) => actorRoles.includes(role)),
    );
    if (allowed.length !== refs.length) {
      this.audit.record({
        actorId,
        actorRole: actorRoles[0] ?? 'unknown',
        action: 'evidence.access_denied',
        targetType: 'safety_report',
        targetId: reportId,
        metadata: {
          gigId: report.gigId,
          requestedCount: refs.length,
          allowedCount: allowed.length,
        },
      });
      throw new MarketplaceError('Not authorized to access safety evidence refs', 'forbidden');
    }
    const accessedAt = new Date(this.now()).toISOString();
    this.checkAdminActionLimit(actorId, 'evidence_refs_accessed', 'safety_report', reportId, {
      gigId: report.gigId,
    });
    const accessed = await Promise.all(
      allowed.map((ref) => this.evidenceVaultRefs.markAccessed(ref.ref, actorId, accessedAt)),
    );
    this.audit.record({
      actorId,
      actorRole: actorRoles[0] ?? 'unknown',
      action: 'evidence.refs_accessed',
      targetType: 'safety_report',
      targetId: reportId,
      metadata: {
        gigId: report.gigId,
        evidenceCount: allowed.length,
        legalHoldCount: allowed.filter((ref) => ref.legalHold).length,
      },
    });
    return accessed.filter((ref): ref is EvidenceVaultRef => Boolean(ref));
  }

  listSafetyReports(filters?: { status?: string; gigId?: string }): Promise<SafetyReport[]> {
    return this.safetyReports.list(filters);
  }

  async listSafetyReportsForAdmin(filters?: { status?: string; gigId?: string }) {
    const reports = await this.safetyReports.list(filters);
    const allReports = await this.safetyReports.list();
    return Promise.all(
      reports.map(async (report) => {
        const context = await this.buildAdminSafetyReportContext(report, allReports);
        return { ...report, ...context };
      }),
    );
  }

  private async buildAdminSafetyReportContext(
    report: SafetyReport,
    allReports: SafetyReport[],
  ): Promise<AdminSafetyReportContext> {
    const reportedUserRole = await this.identifyReportedUserRole(report);
    const sameUserReports = report.reportedUserId
      ? allReports.filter((candidate) => candidate.reportedUserId === report.reportedUserId)
      : [];
    const highSeverityReports = sameUserReports.filter((candidate) =>
      ['high', 'critical'].includes(candidate.severity),
    );
    const targetStatus = await this.resolveReportedUserStatus(report.reportedUserId, reportedUserRole);
    return {
      reportedUserRole,
      reportedUserStatus: targetStatus.status,
      reportedUserVerificationStatus: targetStatus.verificationStatus,
      reportedUserReportCount: sameUserReports.length,
      reportedUserHighSeverityReportCount: highSeverityReports.length,
    };
  }

  private async identifyReportedUserRole(report: SafetyReport): Promise<ReportedUserRole> {
    if (!report.reportedUserId) return 'unknown';
    const gig = await this.getGig(report.gigId);
    if (report.reportedUserId === gig.giverId) return 'giver';
    const applications = await this.applications.listForGig(report.gigId);
    return applications.some((application) => application.workerId === report.reportedUserId)
      ? 'worker'
      : 'unknown';
  }

  private async resolveReportedUserStatus(
    reportedUserId: string | undefined,
    role: ReportedUserRole,
  ): Promise<{ status?: string; verificationStatus?: string }> {
    if (!reportedUserId) return {};
    if (role === 'giver') {
      const giver = await this.givers.findByUser(reportedUserId);
      return {
        status: giver?.status,
        verificationStatus: giver?.verificationStatus,
      };
    }
    if (role === 'worker') {
      const worker = await this.users.findById(reportedUserId);
      return { status: worker?.status };
    }
    return {};
  }

  async reviewSafetyReport(
    reportId: string,
    reviewerId: string,
    status: Extract<SafetyReportStatus, 'under_review' | 'action_taken' | 'escalated' | 'closed'>,
    actionTaken: string,
    lawEnforcementRef?: string,
    decisionNote?: AdminDecisionNote,
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
        decision: summarizeDecision(decisionNote, actionTaken),
      },
    });
    return updated;
  }

  async deactivateGiverFromSafetyReport(
    reportId: string,
    reviewerId: string,
    decisionNote: AdminDecisionNote,
  ) {
    const report = await this.safetyReports.findById(reportId);
    if (!report) throw new MarketplaceError('Safety report not found', 'not_found');
    const gig = await this.getGig(report.gigId);
    if (report.reportedUserId !== gig.giverId) {
      throw new MarketplaceError('Safety report does not target the gig giver', 'invalid_state');
    }
    if (!['under_review', 'action_taken', 'escalated'].includes(report.status)) {
      throw new MarketplaceError('Safety report must be under review before deactivation', 'invalid_state');
    }
    const giver = await this.givers.findByUser(gig.giverId);
    if (!giver) throw new MarketplaceError('Giver profile not found', 'not_found');
    const updatedGiver = {
      ...giver,
      status: 'deactivated_abusive' as const,
      reverificationReason: `safety_report:${report.id}:${decisionNote.reasonCode}`,
    };
    await this.givers.save(updatedGiver);
    const quarantine = await this.quarantineGiverGigs(
      gig.giverId,
      reviewerId,
      `safety_report:${report.id}:${decisionNote.reasonCode}`,
    );
    this.audit.record({
      actorId: reviewerId,
      actorRole: 'fraud_analyst',
      action: 'giver.deactivated_abusive',
      targetType: 'giver',
      targetId: gig.giverId,
      metadata: {
        reportId,
        gigId: gig.id,
        reason: report.reason,
        severity: report.severity,
        quarantinedGigIds: quarantine.quarantinedGigIds,
        flaggedGigIds: quarantine.flaggedGigIds,
        withdrawnApplicationIds: quarantine.withdrawnApplicationIds,
        decision: summarizeDecision(decisionNote, 'Giver deactivated from safety report'),
      },
    });
    return updatedGiver;
  }

  async suspendWorkerFromSafetyReport(
    reportId: string,
    reviewerId: string,
    decisionNote: AdminDecisionNote,
  ) {
    const report = await this.safetyReports.findById(reportId);
    if (!report) throw new MarketplaceError('Safety report not found', 'not_found');
    if (!report.reportedUserId) {
      throw new MarketplaceError('Safety report does not identify a worker', 'invalid_state');
    }
    const gigApplications = await this.applications.listForGig(report.gigId);
    if (!gigApplications.some((application) => application.workerId === report.reportedUserId)) {
      throw new MarketplaceError('Safety report does not target a worker on this gig', 'invalid_state');
    }
    if (!['under_review', 'action_taken', 'escalated'].includes(report.status)) {
      throw new MarketplaceError('Safety report must be under review before suspension', 'invalid_state');
    }
    const worker = await this.users.findById(report.reportedUserId);
    if (!worker || !worker.roles.includes('worker')) {
      throw new MarketplaceError('Worker account not found', 'not_found');
    }
    const updatedWorker = { ...worker, status: 'suspended' as const };
    await this.users.save(updatedWorker);
    const quarantine = await this.quarantineWorkerActivity(
      worker.id,
      reviewerId,
      `safety_report:${report.id}:${decisionNote.reasonCode}`,
    );
    this.audit.record({
      actorId: reviewerId,
      actorRole: 'fraud_analyst',
      action: 'worker.suspended_abusive',
      targetType: 'worker',
      targetId: worker.id,
      metadata: {
        reportId,
        gigId: report.gigId,
        reason: report.reason,
        severity: report.severity,
        flaggedGigIds: quarantine.flaggedGigIds,
        withdrawnApplicationIds: quarantine.withdrawnApplicationIds,
        decision: summarizeDecision(decisionNote, 'Worker suspended from safety report'),
      },
    });
    return updatedWorker;
  }

  private async quarantineWorkerActivity(
    workerId: string,
    reviewerId: string,
    reason: string,
  ): Promise<{ flaggedGigIds: string[]; withdrawnApplicationIds: string[] }> {
    const applications = await this.applications.listForWorker(workerId);
    const flaggedGigIds: string[] = [];
    const withdrawnApplicationIds: string[] = [];
    const moderatedAt = new Date(this.now()).toISOString();

    for (const application of applications) {
      if (application.status === 'applied') {
        await this.applications.save({ ...application, status: 'withdrawn' });
        withdrawnApplicationIds.push(application.id);
        continue;
      }
      if (application.status !== 'selected') continue;
      const gig = await this.getGig(application.gigId);
      if (gig.status === 'completed' || gig.status === 'cancelled') continue;
      await this.gigs.save({
        ...gig,
        visibilityStatus: 'flagged',
        riskLevel: 'high',
        safetyFlags: [...new Set([...gig.safetyFlags, 'worker_suspended_abusive'])].sort(),
        moderatedBy: reviewerId,
        moderatedAt,
        moderationReason: reason,
      });
      flaggedGigIds.push(gig.id);
    }

    return {
      flaggedGigIds: flaggedGigIds.sort(),
      withdrawnApplicationIds: withdrawnApplicationIds.sort(),
    };
  }

  private async quarantineGiverGigs(
    giverId: string,
    reviewerId: string,
    reason: string,
  ): Promise<{
    quarantinedGigIds: string[];
    flaggedGigIds: string[];
    withdrawnApplicationIds: string[];
  }> {
    const gigs = await this.gigs.list({ giverId });
    const quarantinedGigIds: string[] = [];
    const flaggedGigIds: string[] = [];
    const withdrawnApplicationIds: string[] = [];
    const moderatedAt = new Date(this.now()).toISOString();

    for (const gig of gigs) {
      if (gig.status === 'completed' || gig.status === 'cancelled') continue;
      const safetyFlags = [...new Set([...gig.safetyFlags, 'giver_deactivated_abusive'])].sort();
      const shouldCancel = gig.status === 'posted' || gig.status === 'applied';
      const updatedGig: Gig = {
        ...gig,
        status: shouldCancel ? 'cancelled' : gig.status,
        visibilityStatus: 'flagged',
        riskLevel: 'high',
        safetyFlags,
        moderatedBy: reviewerId,
        moderatedAt,
        moderationReason: reason,
      };
      await this.gigs.save(updatedGig);
      if (shouldCancel) {
        quarantinedGigIds.push(gig.id);
        const applications = await this.applications.listForGig(gig.id);
        for (const application of applications) {
          if (application.status !== 'applied') continue;
          await this.applications.save({ ...application, status: 'withdrawn' });
          withdrawnApplicationIds.push(application.id);
        }
      } else {
        flaggedGigIds.push(gig.id);
      }
    }

    return {
      quarantinedGigIds: quarantinedGigIds.sort(),
      flaggedGigIds: flaggedGigIds.sort(),
      withdrawnApplicationIds: withdrawnApplicationIds.sort(),
    };
  }

  async resolveSafetyDispute(
    reportId: string,
    reviewerId: string,
    outcome: DisputeResolutionOutcome,
    actionTaken: string,
    lawEnforcementRef?: string,
    decisionNote?: AdminDecisionNote,
  ): Promise<SafetyReport> {
    if (!isDisputeResolutionOutcome(outcome)) {
      throw new MarketplaceError('Invalid dispute resolution outcome', 'invalid_dispute_outcome');
    }
    const report = await this.safetyReports.findById(reportId);
    if (!report) throw new MarketplaceError('Safety report not found', 'not_found');
    this.requireSecondReviewer(report, reviewerId, 'safety.dispute_resolution');
    this.checkAdminActionLimit(reviewerId, 'dispute_resolution', 'safety_report', reportId, {
      gigId: report.gigId,
      outcome,
    });
    const gig = await this.getGig(report.gigId);
    const assignment = await this.assignments.findByGig(report.gigId);
    if (!assignment) throw new MarketplaceError('Gig has no assignment', 'not_assigned');
    if (!this.money && outcome !== 'keep_escalated') {
      throw new MarketplaceError('Money service is required for dispute money outcomes', 'invalid_state');
    }

    if (outcome === 'release_to_worker') {
      await this.money!.releaseDisputedEscrow({
        gigId: gig.id,
        assignmentId: assignment.id,
        reportId,
        workerId: assignment.workerId,
        agreedAmount: assignment.agreedAmount,
        platformFeeAmount: assignment.platformFeeAmount,
        workerPayoutAmount: assignment.workerPayoutAmount,
        actorId: reviewerId,
        reviewerId,
      });
      await this.gigs.save({ ...gig, status: 'completed' });
    }
    if (outcome === 'refund_giver') {
      await this.money!.refundDisputedEscrow({
        gigId: gig.id,
        assignmentId: assignment.id,
        reportId,
        amount: assignment.agreedAmount,
        reviewerId,
      });
      await this.gigs.save({ ...gig, status: 'cancelled' });
    }

    const updated: SafetyReport = {
      ...report,
      status: outcome === 'keep_escalated' ? 'escalated' : 'action_taken',
      actionTaken: actionTaken.trim(),
      reviewedBy: reviewerId,
      reviewedAt: new Date(this.now()).toISOString(),
      lawEnforcementRef,
    };
    await this.safetyReports.save(updated);
    this.audit.record({
      actorId: reviewerId,
      actorRole: 'fraud_analyst',
      action: `safety.dispute_${outcome}`,
      targetType: 'safety_report',
      targetId: reportId,
      metadata: {
        gigId: report.gigId,
        reason: report.reason,
        severity: report.severity,
        lawEnforcementRef: lawEnforcementRef ? '[recorded]' : undefined,
        decision: summarizeDecision(decisionNote, actionTaken),
      },
    });
    return updated;
  }

  async generateSafetyEscalationPackage(
    reportId: string,
    reviewerId: string,
    decisionNote?: AdminDecisionNote,
  ): Promise<SafetyEscalationPackage> {
    const report = await this.safetyReports.findById(reportId);
    if (!report) throw new MarketplaceError('Safety report not found', 'not_found');
    this.requireSecondReviewer(report, reviewerId, 'safety.escalation_package');
    this.checkAdminActionLimit(reviewerId, 'escalation_package_generated', 'safety_report', reportId, {
      gigId: report.gigId,
    });
    if (!isEscalationWorthy(report)) {
      throw new MarketplaceError('Only serious safety reports can generate escalation packages', 'invalid_state');
    }
    const gig = await this.getGig(report.gigId);
    const assignment = await this.assignments.findByGig(report.gigId);
    const [directGigAudit, linkedGigAudit, reportAudit, moneyTrail] = await Promise.all([
      this.audit.list({ targetType: 'gig', targetId: report.gigId }),
      this.audit.list({ metadata: { gigId: report.gigId } }),
      this.audit.list({ targetType: 'safety_report', targetId: reportId }),
      this.money ? this.money.moneyTrailForGig(report.gigId) : Promise.resolve(null),
    ]);
    const auditTrail = uniqueAuditRecords([...directGigAudit, ...linkedGigAudit, ...reportAudit]);
    const generatedAt = new Date(this.now()).toISOString();
    const snapshotHash = hashEscalationSnapshot({
      generatedAt,
      generatedBy: reviewerId,
      report,
      gig,
      assignment,
      evidenceVaultRefs: report.evidenceVaultRefs,
    });
    const manifest: EscalationPackageManifest = {
      id: `escpkg_${this.id()}`,
      reportId,
      gigId: report.gigId,
      generatedBy: reviewerId,
      generatedAt,
      evidenceVaultRefs: [...report.evidenceVaultRefs],
      snapshotSchemaVersion: ESCALATION_SNAPSHOT_SCHEMA_VERSION,
      snapshotHash,
      retrievalCount: 0,
    };
    await this.escalationPackages.save(manifest);
    const pkg: SafetyEscalationPackage = {
      id: manifest.id,
      generatedAt,
      generatedBy: reviewerId,
      purpose: 'lawful_safety_escalation',
      report,
      gig,
      assignment,
      manifest,
      evidenceVaultRefs: [...report.evidenceVaultRefs],
      integrity: {
        algorithm: 'sha256',
        snapshotSchemaVersion: manifest.snapshotSchemaVersion,
        snapshotHash: manifest.snapshotHash,
        verified: true,
        verifiedAt: generatedAt,
      },
      auditTrail,
      moneyTrail,
      piiPolicy: {
        rawAadhaarStored: false,
        rawSelfieIncluded: false,
        evidenceRefsOnly: true,
      },
    };
    this.audit.record({
      actorId: reviewerId,
      actorRole: 'fraud_analyst',
      action: 'safety.escalation_package_generated',
      targetType: 'safety_report',
      targetId: reportId,
      metadata: {
        gigId: report.gigId,
        packageId: pkg.id,
        evidenceCount: report.evidenceVaultRefs.length,
        snapshotSchemaVersion: manifest.snapshotSchemaVersion,
        decision: summarizeDecision(decisionNote, 'Escalation package generated'),
      },
    });
    return pkg;
  }

  async retrieveSafetyEscalationPackage(
    packageId: string,
    reviewerId: string,
  ): Promise<SafetyEscalationPackage> {
    const manifest = await this.escalationPackages.markRetrieved(
      packageId,
      reviewerId,
      new Date(this.now()).toISOString(),
    );
    if (!manifest) throw new MarketplaceError('Escalation package not found', 'not_found');
    const pkg = await this.buildSafetyEscalationPackageFromManifest(manifest);
    this.audit.record({
      actorId: reviewerId,
      actorRole: 'fraud_analyst',
      action: 'safety.escalation_package_retrieved',
      targetType: 'safety_report',
      targetId: manifest.reportId,
      metadata: {
        gigId: manifest.gigId,
        packageId: manifest.id,
        retrievalCount: manifest.retrievalCount,
        integrityVerified: pkg.integrity.verified,
      },
    });
    return pkg;
  }

  private async buildSafetyEscalationPackageFromManifest(
    manifest: EscalationPackageManifest,
  ): Promise<SafetyEscalationPackage> {
    const report = await this.safetyReports.findById(manifest.reportId);
    if (!report) throw new MarketplaceError('Safety report not found', 'not_found');
    const gig = await this.getGig(manifest.gigId);
    const assignment = await this.assignments.findByGig(manifest.gigId);
    const [directGigAudit, linkedGigAudit, reportAudit, moneyTrail] = await Promise.all([
      this.audit.list({ targetType: 'gig', targetId: manifest.gigId }),
      this.audit.list({ metadata: { gigId: manifest.gigId } }),
      this.audit.list({ targetType: 'safety_report', targetId: manifest.reportId }),
      this.money ? this.money.moneyTrailForGig(manifest.gigId) : Promise.resolve(null),
    ]);
    const verifiedAt = new Date(this.now()).toISOString();
    const currentSnapshotHash = hashEscalationSnapshot({
      generatedAt: manifest.generatedAt,
      generatedBy: manifest.generatedBy,
      report,
      gig,
      assignment,
      evidenceVaultRefs: manifest.evidenceVaultRefs,
    });
    return {
      id: manifest.id,
      generatedAt: manifest.generatedAt,
      generatedBy: manifest.generatedBy,
      purpose: 'lawful_safety_escalation',
      report,
      gig,
      assignment,
      manifest,
      evidenceVaultRefs: [...manifest.evidenceVaultRefs],
      integrity: {
        algorithm: 'sha256',
        snapshotSchemaVersion: manifest.snapshotSchemaVersion,
        snapshotHash: manifest.snapshotHash,
        verified:
          manifest.snapshotSchemaVersion === ESCALATION_SNAPSHOT_SCHEMA_VERSION &&
          currentSnapshotHash === manifest.snapshotHash,
        verifiedAt,
      },
      auditTrail: uniqueAuditRecords([...directGigAudit, ...linkedGigAudit, ...reportAudit]),
      moneyTrail,
      piiPolicy: {
        rawAadhaarStored: false,
        rawSelfieIncluded: false,
        evidenceRefsOnly: true,
      },
    };
  }

  async transitionGig(gigId: string, actorId: string, next: Extract<GigStatus, 'in_progress' | 'completed' | 'cancelled'>): Promise<Gig> {
    const gig = await this.getGig(gigId);
    const assignment = await this.assignments.findByGig(gigId);
    if (!assignment) throw new MarketplaceError('Gig has no assignment', 'not_assigned');
    if (requiresSafetyResolution(gig)) {
      throw new MarketplaceError('Gig is locked for safety review', 'safety_review_required');
    }

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
    const updated = { ...gig, status: next };
    await this.gigs.save(updated);
    this.audit.record({
      actorId,
      actorRole: actorId === gig.giverId ? 'giver' : 'worker',
      action: `gig.${next}`,
      targetType: 'gig',
      targetId: gigId,
    });
    return updated;
  }

  async rateGig(gigId: string, raterId: string, input: RateGigInput): Promise<Rating> {
    if (!Number.isInteger(input.stars) || input.stars < 1 || input.stars > 5) {
      throw new MarketplaceError('Rating stars must be between 1 and 5', 'invalid_rating');
    }
    const gig = await this.getGig(gigId);
    if (gig.status !== 'completed') {
      throw new MarketplaceError('Gig must be completed before rating', 'rating_not_open');
    }
    const assignment = await this.assignments.findByGig(gigId);
    if (!assignment) throw new MarketplaceError('Gig has no assignment', 'not_assigned');

    let direction: RatingDirection;
    let rateeId: string;
    if (raterId === gig.giverId) {
      direction = 'giver_to_worker';
      rateeId = assignment.workerId;
    } else if (raterId === assignment.workerId) {
      direction = 'worker_to_giver';
      rateeId = gig.giverId;
    } else {
      throw new MarketplaceError('Only gig parties can rate this gig', 'forbidden');
    }

    const existing = await this.ratings.findByGigAndDirection(gigId, direction);
    if (existing) return existing;

    const rating: Rating = {
      id: `rating_${this.id()}`,
      gigId,
      raterId,
      rateeId,
      direction,
      stars: input.stars,
      tags: sanitizeRatingTags(input.tags),
      comment: sanitizeRatingComment(input.comment),
      createdAt: new Date(this.now()).toISOString(),
    };
    await this.ratings.save(rating);
    this.audit.record({
      actorId: raterId,
      actorRole: direction === 'giver_to_worker' ? 'giver' : 'worker',
      action: 'gig.rating_submitted',
      targetType: 'gig',
      targetId: gigId,
      metadata: {
        direction,
        stars: rating.stars,
        tags: rating.tags,
        commentLength: rating.comment?.length ?? 0,
      },
    });
    return rating;
  }

  private async requireGiverGig(gigId: string, giverId: string): Promise<Gig> {
    const gig = await this.getGig(gigId);
    if (gig.giverId !== giverId) {
      throw new MarketplaceError('Only the giver can manage this gig', 'forbidden');
    }
    return gig;
  }

  private async registerEvidenceRefs(report: SafetyReport): Promise<void> {
    const legalHold = isEscalationWorthy(report);
    await Promise.all(
      report.evidenceVaultRefs.map(async (ref) => {
        const existing = await this.evidenceVaultRefs.findByRef(ref);
        const createdAt = existing?.createdAt ?? new Date(this.now()).toISOString();
        await this.evidenceVaultRefs.save({
          ref,
          reportId: report.id,
          gigId: report.gigId,
          classification: classifyEvidenceRef(ref),
          retentionPolicy: legalHold ? 'legal_hold' : 'safety_case_standard',
          legalHold,
          allowedRoles: ['fraud_analyst', 'dispute_officer', 'super_admin'],
          createdBy: existing?.createdBy ?? report.reporterId,
          createdAt,
          accessCount: existing?.accessCount ?? 0,
          lastAccessedBy: existing?.lastAccessedBy,
          lastAccessedAt: existing?.lastAccessedAt,
        });
      }),
    );
    if (report.evidenceVaultRefs.length) {
      this.audit.record({
        actorId: report.reporterId,
        actorRole: 'user',
        action: 'evidence.refs_registered',
        targetType: 'safety_report',
        targetId: report.id,
        metadata: {
          gigId: report.gigId,
          evidenceCount: report.evidenceVaultRefs.length,
          retentionPolicy: legalHold ? 'legal_hold' : 'safety_case_standard',
          legalHold,
        },
      });
    }
  }

  private requireSecondReviewer(
    report: SafetyReport,
    actorId: string,
    action: 'safety.dispute_resolution' | 'safety.escalation_package',
  ): void {
    if (!report.reviewedBy || report.reviewedBy !== actorId) return;
    this.audit.record({
      actorId,
      actorRole: 'fraud_analyst',
      action: 'admin.maker_checker_denied',
      targetType: 'safety_report',
      targetId: report.id,
      metadata: {
        gigId: report.gigId,
        attemptedAction: action,
      },
    });
    throw new MarketplaceError(
      'A second reviewer is required for this high-risk admin action',
      'second_reviewer_required',
    );
  }

  private checkAdminActionLimit(
    actorId: string,
    action: AdminThrottledAction,
    targetType: string,
    targetId: string,
    metadata: Record<string, unknown> = {},
  ): void {
    const limit = ADMIN_ACTION_LIMITS[action];
    const now = this.now();
    const key = `${actorId}:${action}`;
    const since = now - limit.windowMs;
    const recent = (this.adminActionAttempts.get(key) ?? []).filter((at) => at > since);
    if (recent.length >= limit.max) {
      const retryAfterMs = Math.max(0, recent[0] + limit.windowMs - now);
      this.audit.record({
        actorId,
        actorRole: 'fraud_analyst',
        action: 'admin.rate_limit_blocked',
        targetType,
        targetId,
        metadata: {
          ...metadata,
          throttledAction: action,
          limit: limit.max,
          windowMs: limit.windowMs,
          retryAfterMs,
        },
      });
      throw new MarketplaceError(
        'Too many high-risk admin actions in a short period',
        'admin_rate_limited',
      );
    }
    recent.push(now);
    this.adminActionAttempts.set(key, recent);
  }
}

function randomId(): string {
  return randomBytes(10).toString('hex');
}

function pricingGuideFor(categoryId: string): PricingGuide | undefined {
  return DEFAULT_PRICING_GUIDES.find((guide) => guide.categoryId === categoryId);
}

function quoteNegotiationTokens(
  budgetAmount: number,
  proposedPrice?: number,
): { priceDeltaAmount: number; negotiationTokenCost: number } {
  const priceDeltaAmount = Math.max(0, (proposedPrice ?? budgetAmount) - budgetAmount);
  return {
    priceDeltaAmount,
    negotiationTokenCost:
      priceDeltaAmount === 0 ? 0 : Math.ceil(priceDeltaAmount / NEGOTIATION_TOKEN_PRICE_STEP),
  };
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

function sanitizeRatingTags(tags: string[] = []): string[] {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))]
    .slice(0, 5)
    .map((tag) => tag.slice(0, 32));
}

function sanitizeRatingComment(comment?: string): string | undefined {
  const cleaned = comment?.trim();
  return cleaned ? cleaned.slice(0, 500) : undefined;
}

function reputationSignal(
  direction: RatingDirection,
  ratings: Rating[],
): ReputationSignalSummary {
  if (!ratings.length) {
    return {
      direction,
      averageStars: null,
      ratingCount: 0,
      heydoScore: null,
    };
  }
  const averageStars =
    Math.round((ratings.reduce((sum, rating) => sum + rating.stars, 0) / ratings.length) * 100) /
    100;
  return {
    direction,
    averageStars,
    ratingCount: ratings.length,
    heydoScore: Math.round(averageStars * 20),
  };
}

function ratingReviewSummary(rating: Rating): RatingReviewItem['rating'] {
  const { comment, ...safeRating } = rating;
  return {
    ...safeRating,
    commentLength: comment?.length ?? 0,
  };
}

function safetyReasonForRating(rating: Rating): SafetyReportReason {
  const tagReasons: Record<string, SafetyReportReason> = {
    unsafe_location: 'unsafe_location',
    harassment: 'harassment',
    off_platform_payment: 'off_platform_payment',
    sexual_misconduct: 'sexual_misconduct',
    drugs_or_illegal_activity: 'drugs_or_illegal_activity',
    violence_or_threat: 'violence_or_threat',
    fraud: 'fraud',
  };
  for (const tag of rating.tags) {
    const reason = tagReasons[tag];
    if (reason) return reason;
  }
  return 'other';
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

function isDisputeResolutionOutcome(outcome: string): outcome is DisputeResolutionOutcome {
  return ['release_to_worker', 'refund_giver', 'keep_escalated'].includes(outcome);
}

function requiresSafetyResolution(gig: Gig): boolean {
  return gig.visibilityStatus === 'flagged' && gig.riskLevel === 'high';
}

function isEscalationWorthy(report: SafetyReport): boolean {
  return (
    report.status === 'escalated' ||
    report.severity === 'critical' ||
    report.severity === 'high' ||
    ['sexual_misconduct', 'drugs_or_illegal_activity', 'violence_or_threat'].includes(report.reason)
  );
}

function uniqueAuditRecords(records: Awaited<ReturnType<AuditService['list']>>) {
  const byId = new Map(records.map((record) => [record.id, record]));
  return [...byId.values()].sort((a, b) => a.at.localeCompare(b.at));
}

function summarizeDecision(decisionNote: AdminDecisionNote | undefined, fallbackNote: string) {
  const reasonCode = decisionNote?.reasonCode?.trim() || 'free_text_reason';
  const note = decisionNote?.note?.trim() || fallbackNote.trim();
  return {
    reasonCode,
    noteLength: note.length,
  };
}

function classifyEvidenceRef(ref: string): EvidenceVaultRef['classification'] {
  const normalized = ref.toLowerCase();
  if (normalized.includes('chat')) return 'chat';
  if (normalized.includes('audio')) return 'audio';
  if (normalized.includes('image') || normalized.includes('photo')) return 'image';
  if (normalized.includes('video')) return 'video';
  if (normalized.includes('location')) return 'location';
  if (normalized.includes('aadhaar') || normalized.includes('selfie') || normalized.includes('kyc')) {
    return 'identity';
  }
  if (normalized.includes('document') || normalized.includes('address')) return 'document';
  return 'other';
}

function hashEscalationSnapshot(input: {
  generatedAt: string;
  generatedBy: string;
  report: SafetyReport;
  gig: Gig;
  assignment: Assignment | null;
  evidenceVaultRefs: string[];
}): string {
  const snapshot = {
    schemaVersion: ESCALATION_SNAPSHOT_SCHEMA_VERSION,
    purpose: 'lawful_safety_escalation',
    generatedAt: input.generatedAt,
    generatedBy: input.generatedBy,
    report: {
      id: input.report.id,
      gigId: input.report.gigId,
      reporterId: input.report.reporterId,
      reportedUserId: input.report.reportedUserId ?? null,
      reason: input.report.reason,
      severity: input.report.severity,
      description: input.report.description,
      evidenceVaultRefs: [...input.evidenceVaultRefs].sort(),
      status: input.report.status,
      actionTaken: input.report.actionTaken ?? null,
      reviewedBy: input.report.reviewedBy ?? null,
      reviewedAt: input.report.reviewedAt ?? null,
      lawEnforcementRef: input.report.lawEnforcementRef ? '[recorded]' : null,
      createdAt: input.report.createdAt,
    },
    gig: {
      id: input.gig.id,
      giverId: input.gig.giverId,
      categoryId: input.gig.categoryId,
      title: input.gig.title,
      description: input.gig.description,
      location: input.gig.location,
      scheduledAt: input.gig.scheduledAt,
      budgetAmount: input.gig.budgetAmount,
      currency: input.gig.currency,
      status: input.gig.status,
      visibilityStatus: input.gig.visibilityStatus,
      riskLevel: input.gig.riskLevel,
      safetyFlags: [...input.gig.safetyFlags].sort(),
      moderatedBy: input.gig.moderatedBy ?? null,
      moderatedAt: input.gig.moderatedAt ?? null,
      moderationReason: input.gig.moderationReason ?? null,
      createdAt: input.gig.createdAt,
    },
    assignment: input.assignment
      ? {
          id: input.assignment.id,
          gigId: input.assignment.gigId,
          workerId: input.assignment.workerId,
          applicationId: input.assignment.applicationId,
          agreedAmount: input.assignment.agreedAmount,
          platformFeeAmount: input.assignment.platformFeeAmount,
          workerPayoutAmount: input.assignment.workerPayoutAmount,
          selectedAt: input.assignment.selectedAt,
        }
      : null,
  };
  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}
