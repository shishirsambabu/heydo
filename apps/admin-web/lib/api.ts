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
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
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

export interface GiverVerification {
  userId: string;
  displayName: string;
  defaultLocationLabel?: string;
  status: string;
  verificationStatus: string;
  locationEvidenceLabel?: string;
  addressEvidenceVaultRef?: string;
  selfieLivenessSessionId?: string;
  verificationNotes?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  reverificationReason?: string;
  createdAt: string;
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
  reason: string;
  severity: string;
  description: string;
  evidenceVaultRefs: string[];
  status: string;
  actionTaken?: string;
  lawEnforcementRef?: string;
  createdAt: string;
}

// --- Admin auth (dev login; SSO+MFA in Phase 7) ---
export async function devLogin(adminId: string, secret: string): Promise<string> {
  const res = await fetch(`${BASE}/admin/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      adminId,
      secret,
      roles: ['verification_officer', 'fraud_analyst', 'support'],
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

// --- Giver KYC queue ---
export function listGiverVerifications(status = 'pending_review'): Promise<GiverVerification[]> {
  return authed(`/admin/givers/verifications?status=${encodeURIComponent(status)}`) as Promise<
    GiverVerification[]
  >;
}

export function reviewGiverVerification(
  userId: string,
  decision: 'approve' | 'reject' | 'require_reverification',
  notes: string,
) {
  return authed(`/admin/givers/${userId}/verification-review`, {
    method: 'POST',
    body: JSON.stringify({ decision, notes }),
  });
}

// --- Marketplace safety queue ---
export function listReviewGigs(): Promise<AdminGig[]> {
  return authed('/admin/marketplace/gigs/pending-review') as Promise<AdminGig[]>;
}

export function moderateGig(gigId: string, decision: 'approve' | 'reject' | 'flag', reason: string) {
  return authed(`/admin/marketplace/gigs/${gigId}/${decision}`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function listOpenSafetyReports(): Promise<SafetyReport[]> {
  return authed('/admin/marketplace/safety-reports?status=open') as Promise<SafetyReport[]>;
}

export function reviewSafetyReport(
  reportId: string,
  status: 'under_review' | 'action_taken' | 'escalated' | 'closed',
  actionTaken: string,
  lawEnforcementRef?: string,
) {
  return authed(`/admin/marketplace/safety-reports/${reportId}/review`, {
    method: 'POST',
    body: JSON.stringify({ status, actionTaken, lawEnforcementRef }),
  });
}
