import { randomBytes } from 'crypto';
import { AuditService } from '../common/audit/audit.service';
import { PiiVault } from '../common/pii/pii-vault';
import { VerificationStatus } from '../identity/entities';
import { Consent, ConsentPurpose, Verification } from './verification.entities';
import {
  ConsentRepository,
  VerificationRepository,
} from './verification.repository';
import {
  VkycProvider,
  VkycResultNotFinalError,
  VkycSession,
} from './vkyc/vkyc-provider';

/** Port: lets verification keep a worker's profile status in sync. */
export type VerificationSubjectRole = 'worker' | 'giver';

export interface IdentityVerificationSink {
  setStatus(
    userId: string,
    subjectRole: VerificationSubjectRole,
    status: VerificationStatus,
  ): Promise<void>;
}

export interface AccountStatusReader {
  isActive(userId: string): Promise<boolean>;
}

export class VerificationError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'VerificationError';
  }
}

/** Decision policy — tunable, reviewed by Trust Architect + fraud_detection. */
export const FACE_MATCH_THRESHOLD = 0.85;
export const VERIFICATION_VALIDITY_DAYS = 365;
const POLICY_VERSION = 'dpdp-2026-06';

export class VerificationService {
  constructor(
    private readonly verifications: VerificationRepository,
    private readonly consents: ConsentRepository,
    private readonly vkyc: VkycProvider,
    private readonly vault: PiiVault,
    private readonly audit: AuditService,
    private readonly sink: IdentityVerificationSink,
    private readonly accounts: AccountStatusReader,
    private readonly now: () => number = () => Date.now(),
    private readonly id: () => string = () => `ver_${randomBytes(10).toString('hex')}`,
  ) {}

  /** DPDP lawful consent — must be granted before VKYC starts. */
  async recordConsent(userId: string, purpose: ConsentPurpose): Promise<Consent> {
    const consent: Consent = {
      id: `consent_${randomBytes(8).toString('hex')}`,
      userId,
      purpose,
      policyVersion: POLICY_VERSION,
      grantedAt: new Date(this.now()).toISOString(),
    };
    await this.consents.save(consent);
    this.audit.record({
      actorId: userId,
      actorRole: 'user',
      action: 'consent.granted',
      targetType: 'consent',
      targetId: consent.id,
      metadata: { purpose, policyVersion: POLICY_VERSION },
    });
    return consent;
  }

  /** Start a live VKYC session. Requires prior 'vkyc' consent. */
  async start(
    userId: string,
    locale: string,
    subjectRole: VerificationSubjectRole = 'worker',
  ): Promise<VkycSession> {
    const consent = await this.consents.find(userId, 'vkyc');
    if (!consent) {
      throw new VerificationError('VKYC consent required', 'consent_required');
    }
    const session = await this.vkyc.start({ userId, locale, subjectRole });
    const verification: Verification = {
      id: this.id(),
      userId,
      subjectRole,
      vendor: session.vendor,
      sessionId: session.sessionId,
      status: 'pending',
      createdAt: new Date(this.now()).toISOString(),
    };
    await this.verifications.save(verification);
    await this.sink.setStatus(userId, subjectRole, 'pending');
    this.audit.record({
      actorId: userId,
      actorRole: subjectRole,
      action: `${subjectRole}.vkyc.started`,
      targetType: 'verification',
      targetId: verification.id,
      metadata: { vendor: session.vendor, subjectRole },
    });
    return session;
  }

  /**
   * Process the vendor's VKYC result (webhook/poll). Stores only SIGNALS and
   * PII VAULT REFERENCES — never the raw Aadhaar number. Hard-fails auto-reject;
   * passes go to the officer review queue (status stays 'pending').
   */
  async handleVendorResult(sessionId: string): Promise<Verification> {
    const verification = await this.verifications.findBySession(sessionId);
    if (!verification) {
      throw new VerificationError('Unknown session', 'unknown_session');
    }
    if (verification.status !== 'pending' || verification.vendorResultAt) {
      throw new VerificationError('Result already processed', 'already_processed');
    }
    const result = await this.getFinalVendorResult(sessionId);

    // Persist sensitive tokens into the isolated vault; keep only references.
    const aadhaarVaultRef = await this.vault.store(result.aadhaarToken);
    const mediaVaultRef = await this.vault.store(result.mediaRef);

    const hardFail =
      !result.livenessPassed ||
      !result.aadhaarMatch ||
      result.faceMatchScore < FACE_MATCH_THRESHOLD;
    const diditApprovedGiver = !hardFail && verification.subjectRole === 'giver';
    const decisionAt = new Date(this.now()).toISOString();
    const expiresAt = new Date(
      this.now() + VERIFICATION_VALIDITY_DAYS * 24 * 3600 * 1000,
    ).toISOString();

    const updated: Verification = {
      ...verification,
      livenessPassed: result.livenessPassed,
      aadhaarMatch: result.aadhaarMatch,
      faceMatchScore: result.faceMatchScore,
      vendorResultAt: new Date(this.now()).toISOString(),
      aadhaarVaultRef,
      mediaVaultRef,
      status: hardFail ? 'rejected' : diditApprovedGiver ? 'approved' : 'pending',
      decisionReason: hardFail ? 'auto_rejected_signals' : undefined,
      decisionAt: hardFail || diditApprovedGiver ? decisionAt : undefined,
      reviewedBy: diditApprovedGiver ? 'didit' : undefined,
      expiresAt: diditApprovedGiver ? expiresAt : undefined,
    };
    await this.verifications.save(updated);

    await this.sink.setStatus(verification.userId, verification.subjectRole, updated.status);
    this.audit.record({
      actorId: 'system',
      actorRole: 'system',
      action: hardFail
        ? `${verification.subjectRole}.vkyc.auto_rejected`
        : verification.subjectRole === 'giver'
          ? 'giver.vkyc.approved_by_didit'
          : 'worker.vkyc.result_received',
      targetType: 'verification',
      targetId: verification.id,
      // NOTE: signals only — no aadhaar token/media in the audit metadata.
      metadata: {
        livenessPassed: result.livenessPassed,
        aadhaarMatch: result.aadhaarMatch,
        faceMatchScore: result.faceMatchScore,
        subjectRole: verification.subjectRole,
      },
    });
    return updated;
  }

  /** Officer approves a reviewed verification. pending -> approved. */
  async approve(verificationId: string, officerId: string): Promise<Verification> {
    const v = await this.requirePendingReviewed(verificationId);
    const decisionAt = new Date(this.now()).toISOString();
    const expiresAt = new Date(
      this.now() + VERIFICATION_VALIDITY_DAYS * 24 * 3600 * 1000,
    ).toISOString();
    const approved: Verification = {
      ...v,
      status: 'approved',
      reviewedBy: officerId,
      decisionAt,
      expiresAt,
    };
    await this.verifications.save(approved);
    await this.sink.setStatus(v.userId, v.subjectRole, 'approved');
    this.audit.record({
      actorId: officerId,
      actorRole: 'verification_officer',
      action: `${v.subjectRole}.vkyc.approved`,
      targetType: 'verification',
      targetId: v.id,
    });
    return approved;
  }

  /** Officer rejects a reviewed verification. pending -> rejected. */
  async reject(
    verificationId: string,
    officerId: string,
    reason: string,
  ): Promise<Verification> {
    const v = await this.requirePendingReviewed(verificationId);
    const rejected: Verification = {
      ...v,
      status: 'rejected',
      reviewedBy: officerId,
      decisionReason: reason,
      decisionAt: new Date(this.now()).toISOString(),
    };
    await this.verifications.save(rejected);
    await this.sink.setStatus(v.userId, v.subjectRole, 'rejected');
    this.audit.record({
      actorId: officerId,
      actorRole: 'verification_officer',
      action: `${v.subjectRole}.vkyc.rejected`,
      targetType: 'verification',
      targetId: v.id,
      metadata: { reason },
    });
    return rejected;
  }

  /** Admin queue: verifications awaiting officer review. */
  listPendingReview(): Promise<Verification[]> {
    return this.verifications.listPendingReview();
  }

  /** Worker-facing: their current verification status + apply eligibility. */
  async statusFor(
    userId: string,
    subjectRole: VerificationSubjectRole = 'worker',
  ): Promise<{ status: VerificationStatus; canApply: boolean; canPost: boolean }> {
    const v = await this.verifications.findLatestForUser(userId, subjectRole);
    return {
      status: v?.status ?? 'unverified',
      canApply: await this.canApply(userId),
      canPost: await this.canPost(userId),
    };
  }

  /**
   * THE trust gate: can this worker apply to gigs?
   * Only an approved, unexpired verification qualifies. Used by Phase 2.
   */
  async canApply(userId: string): Promise<boolean> {
    if (!(await this.accounts.isActive(userId))) return false;
    const v = await this.verifications.findLatestForUser(userId, 'worker');
    if (!v || v.status !== 'approved') return false;
    if (v.expiresAt && this.now() > Date.parse(v.expiresAt)) return false;
    return true;
  }

  async canPost(userId: string): Promise<boolean> {
    const v = await this.verifications.findLatestForUser(userId, 'giver');
    if (!v || v.status !== 'approved') return false;
    if (v.expiresAt && this.now() > Date.parse(v.expiresAt)) return false;
    return true;
  }

  private async requirePendingReviewed(verificationId: string): Promise<Verification> {
    const v = await this.verifications.findById(verificationId);
    if (!v) throw new VerificationError('Verification not found', 'not_found');
    if (v.status !== 'pending') {
      throw new VerificationError(
        `Cannot decide a verification in status '${v.status}'`,
        'invalid_state',
      );
    }
    if (v.subjectRole === 'giver') {
      throw new VerificationError('Giver decisions are reviewed in Didit', 'external_review_only');
    }
    if (!v.vendorResultAt) {
      throw new VerificationError('Vendor result not yet received', 'no_vendor_result');
    }
    return v;
  }

  private async getFinalVendorResult(sessionId: string) {
    try {
      return await this.vkyc.getResult(sessionId);
    } catch (error) {
      if (error instanceof VkycResultNotFinalError) {
        throw new VerificationError(error.message, 'result_not_final');
      }
      throw error;
    }
  }
}
