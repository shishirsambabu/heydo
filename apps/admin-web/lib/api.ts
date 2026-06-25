// Client for the Heydo backend admin API (browser-side).

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000';

const TOKEN_KEY = 'heydo_admin_token';
const NAME_KEY = 'heydo_admin_name';

export function saveSession(token: string, name: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(NAME_KEY, name);
}
export function getToken(): string | null {
  return typeof window === 'undefined' ? null : localStorage.getItem(TOKEN_KEY);
}
export function getOfficerName(): string {
  return (typeof window === 'undefined' ? null : localStorage.getItem(NAME_KEY)) ?? 'officer';
}
export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(NAME_KEY);
}

async function authed(path: string, init?: RequestInit) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const code = body?.code ? ` (${body.code})` : '';
    const message = body?.message ?? `HTTP ${res.status}`;
    throw new Error(`${message}${code}`);
  }
  return res.status === 201 || res.status === 200 ? res.json().catch(() => ({})) : {};
}

export interface PendingVerification {
  id: string;
  userId: string;
  vendor: string;
  status: string;
  livenessPassed?: boolean;
  aadhaarMatch?: boolean;
  faceMatchScore?: number;
  vendorResultAt?: string;
  // NOTE: aadhaarToken / media are NEVER in this payload — PII stays in the vault.
}

export interface AdminGig {
  id: string;
  giverId: string;
  categoryId: string;
  title: string;
  description: string;
  location: string;
  scheduledAt: string;
  budgetAmount: number;
  currency: 'INR';
  status: string;
  visibilityStatus: string;
  riskLevel: string;
  safetyFlags: string[];
  moderationReason?: string;
  createdAt: string;
}

export interface SafetyReport {
  id: string;
  gigId: string;
  reporterId: string;
  reportedUserId?: string;
  reportedUserRole?: 'giver' | 'worker' | 'unknown';
  reason: string;
  severity: string;
  description: string;
  evidenceVaultRefs: string[];
  status: string;
  actionTaken?: string;
  lawEnforcementRef?: string;
  createdAt: string;
}

export type RatingDirection = 'giver_to_worker' | 'worker_to_giver';

export interface ReputationSignalSummary {
  direction: RatingDirection;
  averageStars: number | null;
  ratingCount: number;
  heydoScore: number | null;
}

export interface RatingReviewItem {
  rating: {
    id: string;
    gigId: string;
    raterId: string;
    rateeId: string;
    direction: RatingDirection;
    stars: number;
    tags: string[];
    createdAt: string;
    commentLength: number;
  };
  gig: AdminGig;
  rateeReputation: {
    userId: string;
    asWorker: ReputationSignalSummary;
    asGiver: ReputationSignalSummary;
  };
}

export type AdminDecisionReasonAction =
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
  | 'worker.suspend_abusive';

export interface AdminDecisionReason {
  code: string;
  label: string;
  requiresLawEnforcementRef?: boolean;
}

export type AdminDecisionReasonCatalog = Record<AdminDecisionReasonAction, AdminDecisionReason[]>;

export interface AdminDecisionPayload {
  reasonCode: string;
  note: string;
  lawEnforcementRef?: string;
}

export type DisputeResolutionOutcome = 'release_to_worker' | 'refund_giver' | 'keep_escalated';

export interface SafetyEscalationPackage {
  id: string;
  generatedAt: string;
  generatedBy: string;
  purpose: 'lawful_safety_escalation';
  evidenceVaultRefs: string[];
  integrity: {
    algorithm: 'sha256';
    snapshotSchemaVersion: number;
    snapshotHash: string;
    verified: boolean;
    verifiedAt: string;
  };
  piiPolicy: {
    rawAadhaarStored: false;
    rawSelfieIncluded: false;
    evidenceRefsOnly: true;
  };
}

export interface AuditRecord {
  id: string;
  actorId: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
  at: string;
}

export interface EvidenceVaultRef {
  ref: string;
  reportId: string;
  gigId: string;
  classification: string;
  retentionPolicy: string;
  legalHold: boolean;
  allowedRoles: string[];
  createdBy: string;
  createdAt: string;
  accessCount: number;
  lastAccessedBy?: string;
  lastAccessedAt?: string;
}

export interface MoneyTrailAccount {
  id: string;
  ownerType: string;
  ownerId: string;
  type: string;
  currency: 'INR';
}

export interface MoneyTrailPosting {
  id: string;
  transactionId: string;
  accountId: string;
  direction: 'debit' | 'credit';
  amount: number;
  currency: 'INR';
  account: MoneyTrailAccount | null;
}

export interface MoneyTrailTransaction {
  transaction: {
    id: string;
    type: string;
    gigId?: string;
    idempotencyKey: string;
    status: 'posted';
    createdAt: string;
  };
  postings: MoneyTrailPosting[];
}

export interface GigMoneyTrail {
  hold: {
    id: string;
    gigId: string;
    amount: number;
    status: string;
    providerRef?: string;
    createdAt: string;
  } | null;
  transactions: MoneyTrailTransaction[];
}

export type AdminSessionStatus = 'active' | 'step_up_required' | 'revoked' | 'expired';

export interface AdminSessionListItem {
  id: string;
  adminId: string;
  deviceId: string;
  status: AdminSessionStatus;
  mfaVerifiedAt: string;
  expiresAt: string;
  revokedAt?: string;
  stepUpRequiredAt?: string;
  stepUpReason?: string;
  createdAt: string;
}

export interface AdminSessionList {
  sessions: AdminSessionListItem[];
  summary: Record<AdminSessionStatus, number>;
}

export interface AuditHealth {
  status: 'ok' | 'degraded';
  failedWriteCount: number;
  recentFailures: Array<{
    recordId: string;
    action: string;
    targetType: string;
    targetId: string;
    error: string;
    at: string;
  }>;
}

// --- Admin auth (dev login; SSO+MFA in Phase 7) ---
export async function devLogin(adminId: string, secret: string): Promise<string> {
  const res = await fetch(`${BASE}/admin/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      adminId,
      secret,
      roles: ['verification_officer', 'fraud_analyst', 'support', 'super_admin'],
    }),
  });
  if (!res.ok) throw new Error(`Login failed (HTTP ${res.status})`);
  const data = await res.json();
  return data.token as string;
}

// --- Verification queue ---
export function listPending(): Promise<PendingVerification[]> {
  return authed('/admin/verifications/pending') as Promise<PendingVerification[]>;
}
export function approve(id: string) {
  return authed(`/admin/verifications/${id}/approve`, { method: 'POST' });
}
export function reject(id: string, reason: string) {
  return authed(`/admin/verifications/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

// --- Marketplace safety queue ---
export function listReviewGigs(): Promise<AdminGig[]> {
  return authed('/admin/marketplace/gigs/pending-review') as Promise<AdminGig[]>;
}

export function getDecisionReasons(): Promise<AdminDecisionReasonCatalog> {
  return authed('/admin/marketplace/decision-reasons') as Promise<AdminDecisionReasonCatalog>;
}

export function moderateGig(
  gigId: string,
  decision: 'approve' | 'reject' | 'flag',
  payload: AdminDecisionPayload,
) {
  return authed(`/admin/marketplace/gigs/${gigId}/${decision}`, {
    method: 'POST',
    body: JSON.stringify({
      reasonCode: payload.reasonCode,
      note: payload.note,
    }),
  });
}

export function listOpenSafetyReports(): Promise<SafetyReport[]> {
  return authed('/admin/marketplace/safety-reports?status=open') as Promise<SafetyReport[]>;
}

export async function listActiveSafetyReports(): Promise<SafetyReport[]> {
  const reports = (await authed('/admin/marketplace/safety-reports')) as SafetyReport[];
  return reports.filter((report) => report.status !== 'closed');
}

export function listLowRatingReviews(): Promise<RatingReviewItem[]> {
  return authed('/admin/marketplace/reputation/low-ratings') as Promise<RatingReviewItem[]>;
}

export function openSafetyReportFromRating(
  gigId: string,
  direction: RatingDirection,
  note: string,
): Promise<SafetyReport> {
  return authed(`/admin/marketplace/gigs/${gigId}/ratings/safety-report`, {
    method: 'POST',
    body: JSON.stringify({ direction, note }),
  }) as Promise<SafetyReport>;
}

export function reviewSafetyReport(
  reportId: string,
  status: 'under_review' | 'action_taken' | 'escalated' | 'closed',
  payload: AdminDecisionPayload,
) {
  return authed(`/admin/marketplace/safety-reports/${reportId}/review`, {
    method: 'POST',
    body: JSON.stringify({
      status,
      reasonCode: payload.reasonCode,
      note: payload.note,
      lawEnforcementRef: payload.lawEnforcementRef,
    }),
  });
}

export function deactivateGiverFromSafetyReport(reportId: string, payload: AdminDecisionPayload) {
  return authed(`/admin/marketplace/safety-reports/${reportId}/deactivate-giver`, {
    method: 'POST',
    body: JSON.stringify({
      reasonCode: payload.reasonCode,
      note: payload.note,
    }),
  });
}

export function suspendWorkerFromSafetyReport(reportId: string, payload: AdminDecisionPayload) {
  return authed(`/admin/marketplace/safety-reports/${reportId}/suspend-worker`, {
    method: 'POST',
    body: JSON.stringify({
      reasonCode: payload.reasonCode,
      note: payload.note,
    }),
  });
}

export function resolveSafetyDispute(
  reportId: string,
  outcome: DisputeResolutionOutcome,
  payload: AdminDecisionPayload,
) {
  return authed(`/admin/marketplace/safety-reports/${reportId}/resolve-dispute`, {
    method: 'POST',
    body: JSON.stringify({
      outcome,
      reasonCode: payload.reasonCode,
      note: payload.note,
      lawEnforcementRef: payload.lawEnforcementRef,
    }),
  });
}

export function generateEscalationPackage(
  reportId: string,
  payload: AdminDecisionPayload,
): Promise<SafetyEscalationPackage> {
  return authed(`/admin/marketplace/safety-reports/${reportId}/escalation-package`, {
    method: 'POST',
    body: JSON.stringify({
      reasonCode: payload.reasonCode,
      note: payload.note,
    }),
  }) as Promise<SafetyEscalationPackage>;
}

export function getGigMoneyTrail(gigId: string): Promise<GigMoneyTrail> {
  return authed(`/admin/marketplace/gigs/${gigId}/money-trail`) as Promise<GigMoneyTrail>;
}

export function getGigAuditTrail(gigId: string): Promise<AuditRecord[]> {
  return authed(`/admin/marketplace/gigs/${gigId}/audit-trail`) as Promise<AuditRecord[]>;
}

export function getSafetyReportAuditTrail(reportId: string): Promise<AuditRecord[]> {
  return authed(`/admin/marketplace/safety-reports/${reportId}/audit-trail`) as Promise<AuditRecord[]>;
}

export function listSafetyReportEvidenceRefs(reportId: string): Promise<EvidenceVaultRef[]> {
  return authed(`/admin/marketplace/safety-reports/${reportId}/evidence-refs`) as Promise<EvidenceVaultRef[]>;
}

// --- Admin safety operations ---
export function listAdminSessions(limit = 100): Promise<AdminSessionList> {
  return authed(`/admin/auth/sessions?limit=${limit}`) as Promise<AdminSessionList>;
}

export function revokeAdminSession(sessionId: string, reason: string) {
  return authed(`/admin/auth/sessions/${sessionId}/revoke`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function requireAdminStepUp(sessionId: string, reason: string) {
  return authed(`/admin/auth/sessions/${sessionId}/require-step-up`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function completeDevStepUp(secret: string) {
  return authed('/admin/auth/sessions/current/dev-step-up', {
    method: 'POST',
    body: JSON.stringify({ secret }),
  });
}

export function getAuditHealth(): Promise<AuditHealth> {
  return authed('/admin/marketplace/audit-health') as Promise<AuditHealth>;
}

export function restoreAuditHealth(
  reason: string,
  remediationRef: string,
  investigatedByAdminId: string,
): Promise<AuditHealth> {
  return authed('/admin/marketplace/audit-health/restore', {
    method: 'POST',
    body: JSON.stringify({ reason, remediationRef, investigatedByAdminId }),
  }) as Promise<AuditHealth>;
}
