import { AuditService } from '../common/audit/audit.service';
import { InMemoryPiiVault } from '../common/pii/pii-vault';
import { VerificationStatus } from '../identity/entities';
import {
  InMemoryConsentRepository,
  InMemoryVerificationRepository,
} from './verification.repository';
import {
  VerificationService,
  WorkerVerificationSink,
} from './verification.service';
import { MockVkycProvider } from './vkyc/mock-vkyc-provider';

class FakeSink implements WorkerVerificationSink {
  status = new Map<string, VerificationStatus>();
  async setStatus(userId: string, status: VerificationStatus): Promise<void> {
    this.status.set(userId, status);
  }
}

function build(now: () => number = () => Date.now()) {
  const verifications = new InMemoryVerificationRepository();
  const consents = new InMemoryConsentRepository();
  const vkyc = new MockVkycProvider();
  const vault = new InMemoryPiiVault('test-key');
  const audit = new AuditService();
  const sink = new FakeSink();
  const svc = new VerificationService(verifications, consents, vkyc, vault, audit, sink, now);
  return { svc, vkyc, vault, audit, sink, verifications };
}

describe('VerificationService — VKYC trust gate', () => {
  it('refuses to start VKYC without prior consent', async () => {
    const { svc } = build();
    await expect(svc.start('u1', 'ml')).rejects.toMatchObject({ code: 'consent_required' });
  });

  it('runs the happy path: consent -> start -> result -> officer approval -> can apply', async () => {
    const { svc, sink } = build();
    await svc.recordConsent('u1', 'vkyc');

    const session = await svc.start('u1', 'ml');
    expect(sink.status.get('u1')).toBe('pending');

    const afterResult = await svc.handleVendorResult(session.sessionId);
    expect(afterResult.status).toBe('pending'); // awaits officer review

    // worker cannot apply until an officer approves
    expect(await svc.canApply('u1')).toBe(false);

    const queue = await svc.listPendingReview();
    expect(queue).toHaveLength(1);

    const approved = await svc.approve(queue[0].id, 'officer-7');
    expect(approved.status).toBe('approved');
    expect(approved.reviewedBy).toBe('officer-7');
    expect(sink.status.get('u1')).toBe('approved');
    expect(await svc.canApply('u1')).toBe(true);
  });

  it('NEVER stores the raw Aadhaar token on the record or in the audit log', async () => {
    const { svc, vkyc, vault, audit, verifications } = build();
    await svc.recordConsent('u2', 'vkyc');
    const session = await svc.start('u2', 'ml');
    // force a known aadhaar token so we can assert it is not leaked
    vkyc.queueOutcome(session.sessionId, { aadhaarToken: 'SECRET-AADHAAR-9999' });
    const v = await svc.handleVendorResult(session.sessionId);

    // the record holds a VAULT REFERENCE, not the token
    expect(v.aadhaarVaultRef).toBeDefined();
    expect(JSON.stringify(v)).not.toContain('SECRET-AADHAAR-9999');

    // the token is recoverable only via the vault
    expect(await vault.resolve(v.aadhaarVaultRef!)).toBe('SECRET-AADHAAR-9999');

    // the audit log carries signals only — never the token
    const auditDump = JSON.stringify(audit.entries());
    expect(auditDump).not.toContain('SECRET-AADHAAR-9999');

    // and it is not in the persisted store either
    const stored = await verifications.findById(v.id);
    expect(JSON.stringify(stored)).not.toContain('SECRET-AADHAAR-9999');
  });

  it('auto-rejects on liveness failure and blocks approval', async () => {
    const { svc, vkyc } = build();
    await svc.recordConsent('u3', 'vkyc');
    const session = await svc.start('u3', 'ml');
    vkyc.queueOutcome(session.sessionId, { livenessPassed: false });
    const v = await svc.handleVendorResult(session.sessionId);
    expect(v.status).toBe('rejected');
    expect(await svc.canApply('u3')).toBe(false);
    await expect(svc.approve(v.id, 'officer-1')).rejects.toMatchObject({ code: 'invalid_state' });
  });

  it('auto-rejects when face match is below threshold', async () => {
    const { svc, vkyc } = build();
    await svc.recordConsent('u4', 'vkyc');
    const session = await svc.start('u4', 'ml');
    vkyc.queueOutcome(session.sessionId, { faceMatchScore: 0.4 });
    const v = await svc.handleVendorResult(session.sessionId);
    expect(v.status).toBe('rejected');
  });

  it('does not process a vendor result twice (idempotent guard)', async () => {
    const { svc, vkyc } = build();
    await svc.recordConsent('u5', 'vkyc');
    const session = await svc.start('u5', 'ml');
    await svc.handleVendorResult(session.sessionId);
    await expect(svc.handleVendorResult(session.sessionId)).rejects.toMatchObject({
      code: 'already_processed',
    });
  });

  it('treats an expired approval as not eligible to apply', async () => {
    let t = 1_000_000_000_000;
    const { svc, sink } = build(() => t);
    await svc.recordConsent('u6', 'vkyc');
    const session = await svc.start('u6', 'ml');
    await svc.handleVendorResult(session.sessionId);
    const queue = await svc.listPendingReview();
    await svc.approve(queue[0].id, 'officer-2');
    expect(await svc.canApply('u6')).toBe(true);
    // advance > 365 days
    t += 366 * 24 * 3600 * 1000;
    expect(await svc.canApply('u6')).toBe(false);
    expect(sink.status.get('u6')).toBe('approved'); // status persists; eligibility expires
  });
});
