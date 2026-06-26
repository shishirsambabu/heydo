import { createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { AuditService } from '../common/audit/audit.service';
import { InMemoryPiiVault } from '../common/pii/pii-vault';
import { VerificationStatus } from '../identity/entities';
import { DiditWebhookController } from './didit-webhook.controller';
import {
  InMemoryConsentRepository,
  InMemoryVerificationRepository,
} from './verification.repository';
import {
  IdentityVerificationSink,
  VerificationService,
  VerificationSubjectRole,
} from './verification.service';
import { MockVkycProvider } from './vkyc/mock-vkyc-provider';

class FakeSink implements IdentityVerificationSink {
  status = new Map<string, VerificationStatus>();

  async setStatus(
    userId: string,
    subjectRole: VerificationSubjectRole,
    status: VerificationStatus,
  ): Promise<void> {
    this.status.set(`${subjectRole}:${userId}`, status);
  }
}

function build() {
  const secret = 'didit_webhook_secret';
  const verifications = new InMemoryVerificationRepository();
  const consents = new InMemoryConsentRepository();
  const vkyc = new MockVkycProvider();
  const vault = new InMemoryPiiVault('test-key');
  const audit = new AuditService();
  const sink = new FakeSink();
  const accounts = { isActive: async () => true };
  const service = new VerificationService(
    verifications,
    consents,
    vkyc,
    vault,
    audit,
    sink,
    accounts,
  );
  const config = { get: (key: string) => (key === 'DIDIT_WEBHOOK_SECRET' ? secret : undefined) };
  const controller = new DiditWebhookController(config as ConfigService, service);
  return { controller, service, secret, sink };
}

function signedHeaders(
  secret: string,
  body: { timestamp: number; session_id: string; status: string; webhook_type: string },
) {
  const signatureSimple = createHmac('sha256', secret)
    .update(`${body.timestamp}:${body.session_id}:${body.status}:${body.webhook_type}`)
    .digest('hex');
  return {
    timestamp: String(body.timestamp),
    signatureSimple,
  };
}

describe('DiditWebhookController', () => {
  it('persists worker callback signals while keeping worker pending for Heydo review', async () => {
    const { controller, service, secret, sink } = build();
    await service.recordConsent('worker_1', 'vkyc');
    const session = await service.start('worker_1', 'ml', 'worker');
    const body = {
      timestamp: Math.floor(Date.now() / 1000),
      session_id: session.sessionId,
      status: 'Approved',
      webhook_type: 'status.updated',
    };
    const headers = signedHeaders(secret, body);

    await expect(
      controller.receive(body, headers.timestamp, undefined, headers.signatureSimple),
    ).resolves.toEqual({ ok: true });

    const latest = await service.statusFor('worker_1', 'worker');
    expect(latest).toMatchObject({ status: 'pending', canApply: false });
    expect(sink.status.get('worker:worker_1')).toBe('pending');
    await expect(service.listPendingReview()).resolves.toHaveLength(1);
  });

  it('persists giver callback approval directly from Didit without Heydo admin review', async () => {
    const { controller, service, secret, sink } = build();
    await service.recordConsent('giver_1', 'vkyc');
    const session = await service.start('giver_1', 'ml', 'giver');
    const body = {
      timestamp: Math.floor(Date.now() / 1000),
      session_id: session.sessionId,
      status: 'Approved',
      webhook_type: 'data.updated',
    };
    const headers = signedHeaders(secret, body);

    await expect(
      controller.receive(body, headers.timestamp, undefined, headers.signatureSimple),
    ).resolves.toEqual({ ok: true });

    const latest = await service.statusFor('giver_1', 'giver');
    expect(latest).toMatchObject({ status: 'approved', canPost: true });
    expect(sink.status.get('giver:giver_1')).toBe('approved');
    await expect(service.listPendingReview()).resolves.toHaveLength(0);
  });

  it('treats duplicate and unknown final callbacks as safe idempotent deliveries', async () => {
    const { controller, service, secret } = build();
    await service.recordConsent('giver_2', 'vkyc');
    const session = await service.start('giver_2', 'ml', 'giver');
    const body = {
      timestamp: Math.floor(Date.now() / 1000),
      session_id: session.sessionId,
      status: 'Approved',
      webhook_type: 'status.updated',
    };
    const headers = signedHeaders(secret, body);

    await controller.receive(body, headers.timestamp, undefined, headers.signatureSimple);
    await expect(
      controller.receive(body, headers.timestamp, undefined, headers.signatureSimple),
    ).resolves.toEqual({ ok: true, duplicate: true });

    const unknown = { ...body, session_id: 'unknown_session' };
    const unknownHeaders = signedHeaders(secret, unknown);
    await expect(
      controller.receive(unknown, unknownHeaders.timestamp, undefined, unknownHeaders.signatureSimple),
    ).resolves.toEqual({ ok: true, unknownSession: true });
  });

  it('rejects unsigned or tampered Didit callbacks', async () => {
    const { controller, secret } = build();
    const body = {
      timestamp: Math.floor(Date.now() / 1000),
      session_id: 'session_1',
      status: 'Approved',
      webhook_type: 'status.updated',
    };
    const headers = signedHeaders(secret, body);

    await expect(
      controller.receive({ ...body, status: 'Declined' }, headers.timestamp, undefined, headers.signatureSimple),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
