import { AdminSessionService } from './admin-session.service';
import { InMemoryAdminSessionRepository } from './admin-session.repository';
import { AuthPrincipal } from './auth.types';

describe('AdminSessionService', () => {
  it('accepts a registered fresh admin session for the same device', async () => {
    const repo = new InMemoryAdminSessionRepository();
    const service = new AdminSessionService(repo);
    const session = await service.createSession('admin_1', 'device_1');

    await expect(service.assertFresh(principal(session.id))).resolves.toBeUndefined();
  });

  it('rejects missing, mismatched, revoked, expired, and stale sessions', async () => {
    const repo = new InMemoryAdminSessionRepository();
    const service = new AdminSessionService(repo);
    const session = await service.createSession('admin_1', 'device_1');

    await expect(service.assertFresh({ ...principal(), adminSessionId: undefined })).rejects.toMatchObject({
      code: 'admin_fresh_verification_required',
    });
    await expect(service.assertFresh({ ...principal(session.id), adminDeviceId: 'device_2' })).rejects.toMatchObject({
      code: 'admin_session_untrusted',
    });

    await service.revoke(session.id);
    await expect(service.assertFresh(principal(session.id))).rejects.toMatchObject({
      code: 'admin_session_revoked',
    });

    const expired = await service.createSession('admin_1', 'device_1', -1);
    await expect(service.assertFresh(principal(expired.id))).rejects.toMatchObject({
      code: 'admin_session_expired',
    });

    const stale = await service.createSession('admin_1', 'device_1');
    await expect(service.assertFresh(principal(stale.id), -1)).rejects.toMatchObject({
      code: 'admin_fresh_verification_required',
    });
  });

  it('requires and completes step-up verification on the same admin session', async () => {
    const repo = new InMemoryAdminSessionRepository();
    const service = new AdminSessionService(repo);
    const session = await service.createSession('admin_1', 'device_1');

    const forced = await service.requireStepUp(session.id, 'Suspicious evidence access pattern.');
    expect(forced).toMatchObject({
      id: session.id,
      stepUpReason: 'Suspicious evidence access pattern.',
    });
    expect(forced.stepUpRequiredAt).toBeDefined();
    await expect(service.assertFresh(principal(session.id))).rejects.toMatchObject({
      code: 'admin_step_up_required',
    });

    const completed = await service.completeStepUp(principal(session.id));
    expect(completed).toMatchObject({
      id: session.id,
      stepUpRequiredAt: undefined,
      stepUpReason: undefined,
    });
    await expect(service.assertFresh(principal(session.id))).resolves.toBeUndefined();
  });

  it('lists sessions with derived statuses and bounded summary counts', async () => {
    const repo = new InMemoryAdminSessionRepository();
    const service = new AdminSessionService(repo);
    const active = await service.createSession('admin_1', 'device_1');
    const stepUp = await service.createSession('admin_2', 'device_2');
    await service.requireStepUp(stepUp.id, 'Suspicious access pattern.');
    const revoked = await service.createSession('admin_3', 'device_3');
    await service.revoke(revoked.id);
    await service.createSession('admin_4', 'device_4', -1);

    await expect(service.listSessions(10)).resolves.toMatchObject({
      sessions: expect.arrayContaining([
        expect.objectContaining({ id: active.id, status: 'active' }),
        expect.objectContaining({ id: stepUp.id, status: 'step_up_required' }),
        expect.objectContaining({ id: revoked.id, status: 'revoked' }),
        expect.objectContaining({ adminId: 'admin_4', status: 'expired' }),
      ]),
      summary: {
        active: 1,
        step_up_required: 1,
        revoked: 1,
        expired: 1,
      },
    });
  });
});

function principal(adminSessionId = 'adm_sess_1'): AuthPrincipal {
  return {
    sub: 'admin_1',
    kind: 'admin',
    roles: ['fraud_analyst'],
    adminSessionId,
    adminDeviceId: 'device_1',
  };
}
