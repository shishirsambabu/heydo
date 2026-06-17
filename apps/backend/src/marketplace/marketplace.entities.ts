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

export interface Category {
  id: string;
  nameMl: string;
  nameEn: string;
  group: 'home' | 'creative' | 'care' | 'events' | 'local';
  active: boolean;
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

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat_plumbing', nameMl: 'പ്ലംബിംഗ്', nameEn: 'Plumbing', group: 'home', active: true },
  { id: 'cat_electrical', nameMl: 'ഇലക്ട്രിക്കൽ', nameEn: 'Electrical', group: 'home', active: true },
  { id: 'cat_cleaning', nameMl: 'ക്ലീനിംഗ്', nameEn: 'Cleaning', group: 'home', active: true },
  { id: 'cat_mehendi', nameMl: 'മെഹന്തി', nameEn: 'Mehendi', group: 'creative', active: true },
  { id: 'cat_music', nameMl: 'സംഗീതം', nameEn: 'Music', group: 'creative', active: true },
  { id: 'cat_pet_care', nameMl: 'പെറ്റ് കെയർ', nameEn: 'Pet care', group: 'care', active: true },
  { id: 'cat_event_help', nameMl: 'ഇവന്റ് സഹായം', nameEn: 'Event help', group: 'events', active: true },
];
