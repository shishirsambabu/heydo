/**
 * Identity domain entities (Phase 1).
 * Mirrors docs/phase-0/02-data-model.md. Raw PII (Aadhaar, VKYC media) is NOT
 * stored on these objects — only vault references live on the Verification.
 */

export type UserRole = 'worker' | 'giver';

export type VerificationStatus =
  | 'unverified'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired';

export interface User {
  id: string;
  /** PII — stored here for Phase 1 dev; masked in all logs. */
  phone: string;
  roles: UserRole[];
  locale: string; // 'ml' default
  status: 'active' | 'suspended' | 'deleted';
  createdAt: string;
}

export interface WorkerProfile {
  userId: string;
  displayName: string;
  bioMl?: string;
  bioEn?: string;
  photoUrl?: string;
  skills: string[];
  categoryIds: string[];
  serviceAreaLabel?: string; // coarse area; precise geo is PII-ish, added later
  verificationStatus: VerificationStatus;
  heydoScore: number | null; // null until first gig (Phase 4)
  createdAt: string;
}

export interface GiverProfile {
  userId: string;
  displayName: string;
  defaultLocationLabel?: string;
  status: 'active' | 'deactivated_abusive';
  createdAt: string;
}
