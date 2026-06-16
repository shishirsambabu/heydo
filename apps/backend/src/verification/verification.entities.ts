import { VerificationStatus } from '../identity/entities';

/**
 * Verification & Consent records (Phase 1).
 * Stores VKYC SIGNALS and VAULT REFERENCES only — never the raw Aadhaar number
 * or media. aadhaarVaultRef / mediaVaultRef point into the PII vault.
 * See docs/phase-0/02-data-model.md.
 */
export interface Verification {
  id: string;
  userId: string;
  vendor: string;
  sessionId: string;
  status: VerificationStatus; // unverified | pending | approved | rejected | expired
  // Vendor signals (populated once the live VKYC result arrives):
  livenessPassed?: boolean;
  aadhaarMatch?: boolean;
  faceMatchScore?: number;
  vendorResultAt?: string;
  // PII vault references (NOT raw values):
  aadhaarVaultRef?: string;
  mediaVaultRef?: string;
  // Officer review:
  reviewedBy?: string;
  decisionReason?: string;
  decisionAt?: string;
  expiresAt?: string;
  createdAt: string;
}

export type ConsentPurpose = 'vkyc' | 'payments' | 'notifications';

export interface Consent {
  id: string;
  userId: string;
  purpose: ConsentPurpose;
  policyVersion: string;
  grantedAt: string;
  revokedAt?: string;
}
