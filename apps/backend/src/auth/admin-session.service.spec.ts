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
