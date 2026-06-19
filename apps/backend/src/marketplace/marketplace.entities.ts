export type GigStatus = 'posted' | 'applied' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
export type ApplicationStatus = 'applied' | 'withdrawn' | 'selected' | 'rejected';
export type GigVisibilityStatus = 'pending_review' | 'visible' | 'rejected' | 'flagged';
export type GigRiskLevel = 'low' | 'medium' | 'high';
export type SafetyReportReason =
  | 'sexual_misconduct'
  | 'drugs_or_illegal_activity'
  | 'violence_or_threat'
  | 'unsafe_location'
  | 'harassment'
  | 'off_platform_payment'
  | 'fraud'
  | 'other';
export type SafetyReportSeverity = 'low' | 'medium' | 'high' | 'critical';
export type SafetyReportStatus = 'open' | 'under_review' | 'action_taken' | 'escalated' | 'closed';
export type EvidenceClassification =
  | 'chat'
  | 'audio'
  | 'image'
  | 'video'
  | 'location'
  | 'identity'
  | 'document'
  | 'other';
export type EvidenceRetentionPolicy = 'safety_case_standard' | 'legal_hold';

export interface Category {
  id: string;
  nameMl: string;
  nameEn: string;
  group: 'home' | 'creative' | 'care' | 'events' | 'local';
  active: boolean;
}

export interface PricingGuide {
  categoryId: string;
  minBudgetAmount: number;
  suggestedBudgetAmount: number;
  highReviewAmount: number;
  notes: string;
}

export interface Gig {
  id: string;
  giverId: string;
  categoryId: string;
  title: string;
  description: string;
  location: string;
  scheduledAt: string;
  budgetAmount: number;
  currency: 'INR';
  status: GigStatus;
  visibilityStatus: GigVisibilityStatus;
  riskLevel: GigRiskLevel;
  safetyFlags: string[];
  moderatedBy?: string;
  moderatedAt?: string;
  moderationReason?: string;
  createdAt: string;
}

export interface GigApplication {
  id: string;
  gigId: string;
  workerId: string;
  messageMl?: string;
  proposedPrice?: number;
  status: ApplicationStatus;
  createdAt: string;
}

export interface Assignment {
  id: string;
  gigId: string;
  workerId: string;
  applicationId: string;
  agreedAmount: number;
  platformFeeAmount: number;
  workerPayoutAmount: number;
  selectedAt: string;
}

export interface SafetyReport {
  id: string;
  gigId: string;
  reporterId: string;
  reportedUserId?: string;
  reason: SafetyReportReason;
  severity: SafetyReportSeverity;
  description: string;
  evidenceVaultRefs: string[];
  status: SafetyReportStatus;
  actionTaken?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  lawEnforcementRef?: string;
  createdAt: string;
}

export interface EscalationPackageManifest {
  id: string;
  reportId: string;
  gigId: string;
  generatedBy: string;
  generatedAt: string;
  evidenceVaultRefs: string[];
  snapshotSchemaVersion: number;
  snapshotHash: string;
  retrievalCount: number;
  lastRetrievedBy?: string;
  lastRetrievedAt?: string;
}

export interface EvidenceVaultRef {
  ref: string;
  reportId: string;
  gigId: string;
  classification: EvidenceClassification;
  retentionPolicy: EvidenceRetentionPolicy;
  legalHold: boolean;
  allowedRoles: string[];
  createdBy: string;
  createdAt: string;
  accessCount: number;
  lastAccessedBy?: string;
  lastAccessedAt?: string;
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat_plumbing', nameMl: 'Plumbing', nameEn: 'Plumbing', group: 'home', active: true },
  { id: 'cat_electrical', nameMl: 'Electrical', nameEn: 'Electrical', group: 'home', active: true },
  { id: 'cat_cleaning', nameMl: 'Cleaning', nameEn: 'Cleaning', group: 'home', active: true },
  { id: 'cat_carpentry', nameMl: 'Carpentry', nameEn: 'Carpentry', group: 'home', active: true },
  { id: 'cat_painting', nameMl: 'Painting', nameEn: 'Painting', group: 'home', active: true },
  { id: 'cat_ac_repair', nameMl: 'AC repair', nameEn: 'AC repair', group: 'home', active: true },
  { id: 'cat_mehendi', nameMl: 'Mehendi', nameEn: 'Mehendi', group: 'creative', active: true },
  { id: 'cat_music', nameMl: 'Music', nameEn: 'Music', group: 'creative', active: true },
  { id: 'cat_photography', nameMl: 'Photography', nameEn: 'Photography', group: 'creative', active: true },
  { id: 'cat_makeup', nameMl: 'Makeup', nameEn: 'Makeup', group: 'creative', active: true },
  { id: 'cat_pet_care', nameMl: 'Pet care', nameEn: 'Pet care', group: 'care', active: true },
  { id: 'cat_elder_care', nameMl: 'Elder care', nameEn: 'Elder care', group: 'care', active: true },
  { id: 'cat_tutoring', nameMl: 'Tutoring', nameEn: 'Tutoring', group: 'care', active: true },
  { id: 'cat_event_help', nameMl: 'Event help', nameEn: 'Event help', group: 'events', active: true },
  { id: 'cat_cooking', nameMl: 'Cooking help', nameEn: 'Cooking help', group: 'events', active: true },
  { id: 'cat_house_shifting', nameMl: 'House shifting', nameEn: 'House shifting', group: 'local', active: true },
];

export const DEFAULT_PRICING_GUIDES: PricingGuide[] = [
  { categoryId: 'cat_plumbing', minBudgetAmount: 500, suggestedBudgetAmount: 900, highReviewAmount: 8000, notes: 'Small repair visit; materials billed separately.' },
  { categoryId: 'cat_electrical', minBudgetAmount: 500, suggestedBudgetAmount: 900, highReviewAmount: 10000, notes: 'Basic electrical visit; licensed work may need extra checks.' },
  { categoryId: 'cat_cleaning', minBudgetAmount: 600, suggestedBudgetAmount: 1200, highReviewAmount: 8000, notes: 'Family home cleaning; low or isolated requests require review.' },
  { categoryId: 'cat_carpentry', minBudgetAmount: 700, suggestedBudgetAmount: 1500, highReviewAmount: 15000, notes: 'Small repair or assembly; larger custom work should be scoped.' },
  { categoryId: 'cat_painting', minBudgetAmount: 1000, suggestedBudgetAmount: 2500, highReviewAmount: 25000, notes: 'Room or patch painting; material and area affect final quote.' },
  { categoryId: 'cat_ac_repair', minBudgetAmount: 800, suggestedBudgetAmount: 1500, highReviewAmount: 12000, notes: 'Service visit; spares charged separately.' },
  { categoryId: 'cat_mehendi', minBudgetAmount: 1200, suggestedBudgetAmount: 3000, highReviewAmount: 25000, notes: 'Small event artist booking; wedding bundles may be higher.' },
  { categoryId: 'cat_music', minBudgetAmount: 1500, suggestedBudgetAmount: 5000, highReviewAmount: 50000, notes: 'Performance bookings vary by duration and equipment.' },
  { categoryId: 'cat_photography', minBudgetAmount: 2000, suggestedBudgetAmount: 6000, highReviewAmount: 60000, notes: 'Small shoot coverage; deliverables should be clear.' },
  { categoryId: 'cat_makeup', minBudgetAmount: 1500, suggestedBudgetAmount: 3500, highReviewAmount: 30000, notes: 'Single-person makeup; event packages need exact scope.' },
  { categoryId: 'cat_pet_care', minBudgetAmount: 400, suggestedBudgetAmount: 800, highReviewAmount: 8000, notes: 'Short pet-care visit; overnight care requires review.' },
  { categoryId: 'cat_elder_care', minBudgetAmount: 700, suggestedBudgetAmount: 1400, highReviewAmount: 12000, notes: 'Non-medical help only; medical requests require review.' },
  { categoryId: 'cat_tutoring', minBudgetAmount: 400, suggestedBudgetAmount: 900, highReviewAmount: 10000, notes: 'Per-session tutoring; child safety checks apply.' },
  { categoryId: 'cat_event_help', minBudgetAmount: 800, suggestedBudgetAmount: 1600, highReviewAmount: 20000, notes: 'Event helper shift; hours and transport must be clear.' },
  { categoryId: 'cat_cooking', minBudgetAmount: 800, suggestedBudgetAmount: 1800, highReviewAmount: 15000, notes: 'Home or event cooking help; guest count should be stated.' },
  { categoryId: 'cat_house_shifting', minBudgetAmount: 1000, suggestedBudgetAmount: 2500, highReviewAmount: 25000, notes: 'Local moving help; vehicle and lift requirements must be clear.' },
];
