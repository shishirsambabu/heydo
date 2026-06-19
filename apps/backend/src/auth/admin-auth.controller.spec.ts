import { AdminSessionError } from './admin-session.service';
import { AdminAuthController } from './admin-auth.controller';
import { ROLES_KEY } from './decorators';
import { AuthPrincipal } from './auth.types';
import { AuditHealthError } from '../common/audit/audit.service';

const principal: AuthPrincipal = {
  sub: 'super_1',
  kind: 'admin',
  roles: ['super_admin'],
  adminSessionId: 'adm_sess_current',
  adminDeviceId: 'device_current',
};

describe('AdminAuthController session revocation', () => {
  it('restricts session revocation to super admins', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, AdminAuthController.prototype.sessions),
    ).toEqual(['super_admin']);
    expect(
      Reflect.getMetadata(ROLES_KEY, AdminAuthController.prototype.revokeSession),
    ).toEqual(['super_admin']);
    expect(
      Reflect.getMetadata(ROLES_KEY, AdminAuthController.prototype.requireStepUp),
    ).toEqual(['super_admin']);
  });

  it('revokes another admin session and audits the action', async () => {
    const adminSessions = {
      revoke: jest.fn().mockResolvedValue({
        id: 'adm_sess_target',
        adminId: 'admin_2',
        deviceId: 'device_2',
        mfaVerifiedAt: '2026-06-19T03:00:00.000Z',
        expiresAt: '2026-06-26T03:00:00.000Z',
        revokedAt: '2026-06-19T03:10:00.000Z',
        createdAt: '2026-06-19T03:00:00.000Z',
      }),
    };
    const audit = auditMock();
    const controller = new AdminAuthController({} as never, adminSessions as never, audit as never);

    await expect(
      controller.revokeSession('adm_sess_target', principal, {
        reason: 'Suspicious evidence access pattern.',
      }),
    ).resolves.toEqual({
      revoked: true,
      sessionId: 'adm_sess_target',
      adminId: 'admin_2',
      revokedAt: '2026-06-19T03:10:00.000Z',
    });

    expect(adminSessions.revoke).toHaveBeenCalledWith('adm_sess_target');
    expect(audit.record).toHaveBeenCalledWith({
      actorId: 'super_1',
      actorRole: 'super_admin',
      action: 'admin.session_revoked',
      targetType: 'admin_session',
      targetId: 'adm_sess_target',
      metadata: {
        targetAdminId: 'admin_2',
        targetDeviceId: 'device_2',
        reason: 'Suspicious evidence access pattern.',
      },
    });
  });

  it('lists admin sessions for monitoring and audits the read', async () => {
    const adminSessions = {
      listSessions: jest.fn().mockResolvedValue({
        sessions: [
          {
            id: 'adm_sess_1',
            adminId: 'admin_1',
            deviceId: 'device_1',
            status: 'active',
            mfaVerifiedAt: '2026-06-19T03:00:00.000Z',
            expiresAt: '2026-06-26T03:00:00.000Z',
            createdAt: '2026-06-19T03:00:00.000Z',
          },
        ],
        summary: { active: 1, step_up_required: 0, revoked: 0, expired: 0 },
      }),
    };
    const audit = auditMock();
    const controller = new AdminAuthController({} as never, adminSessions as never, audit as never);

    await expect(controller.sessions(principal, { limit: '25' })).resolves.toEqual({
      sessions: [
        {
          id: 'adm_sess_1',
          adminId: 'admin_1',
          deviceId: 'device_1',
          status: 'active',
          mfaVerifiedAt: '2026-06-19T03:00:00.000Z',
          expiresAt: '2026-06-26T03:00:00.000Z',
          createdAt: '2026-06-19T03:00:00.000Z',
        },
      ],
      summary: { active: 1, step_up_required: 0, revoked: 0, expired: 0 },
    });

    expect(adminSessions.listSessions).toHaveBeenCalledWith(25);
    expect(audit.record).toHaveBeenCalledWith({
      actorId: 'super_1',
      actorRole: 'super_admin',
      action: 'admin.sessions_viewed',
      targetType: 'admin_session',
      targetId: 'list',
      metadata: {
        limit: 25,
        returnedCount: 1,
        summary: { active: 1, step_up_required: 0, revoked: 0, expired: 0 },
      },
    });
  });

  it('blocks admin session monitoring when audit writes are degraded', async () => {
    const adminSessions = { listSessions: jest.fn() };
    const controller = new AdminAuthController(
      {} as never,
      adminSessions as never,
      auditMockWithDegradedHealth() as never,
    );

    await expect(controller.sessions(principal, { limit: '25' })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'audit_degraded', failedWriteCount: 1 }),
    });
    expect(adminSessions.listSessions).not.toHaveBeenCalled();
  });

  it('rejects invalid admin session list limits', async () => {
    const adminSessions = { listSessions: jest.fn() };
    const controller = new AdminAuthController(
      {} as never,
      adminSessions as never,
      auditMock() as never,
    );

    await expect(controller.sessions(principal, { limit: '500' })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'invalid_admin_session_limit' }),
    });
    expect(adminSessions.listSessions).not.toHaveBeenCalled();
  });

  it('blocks revoking the current session through the suspicious-session endpoint', async () => {
    const adminSessions = { revoke: jest.fn() };
    const controller = new AdminAuthController(
      {} as never,
      adminSessions as never,
      auditMock() as never,
    );

    await expect(
      controller.revokeSession('adm_sess_current', principal, {
        reason: 'Trying to revoke current session.',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'admin_cannot_revoke_current_session' }),
    });
    expect(adminSessions.revoke).not.toHaveBeenCalled();
  });

  it('returns a clear not-found code for missing sessions', async () => {
    const adminSessions = {
      revoke: jest
        .fn()
        .mockRejectedValue(new AdminSessionError('Admin session was not found', 'admin_session_not_found')),
    };
    const controller = new AdminAuthController(
      {} as never,
      adminSessions as never,
      auditMock() as never,
    );

    await expect(
      controller.revokeSession('adm_sess_missing', principal, {
        reason: 'Session was reported by security review.',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'admin_session_not_found' }),
    });
  });

  it('forces step-up verification for a suspicious admin session and audits it', async () => {
    const adminSessions = {
      requireStepUp: jest.fn().mockResolvedValue({
        id: 'adm_sess_target',
        adminId: 'admin_2',
        deviceId: 'device_2',
        mfaVerifiedAt: '2026-06-19T03:00:00.000Z',
        expiresAt: '2026-06-26T03:00:00.000Z',
        stepUpRequiredAt: '2026-06-19T03:20:00.000Z',
        stepUpReason: 'Suspicious evidence access pattern.',
        createdAt: '2026-06-19T03:00:00.000Z',
      }),
    };
    const audit = auditMock();
    const controller = new AdminAuthController({} as never, adminSessions as never, audit as never);

    await expect(
      controller.requireStepUp('adm_sess_target', principal, {
        reason: 'Suspicious evidence access pattern.',
      }),
    ).resolves.toEqual({
      stepUpRequired: true,
      sessionId: 'adm_sess_target',
      adminId: 'admin_2',
      stepUpRequiredAt: '2026-06-19T03:20:00.000Z',
    });

    expect(adminSessions.requireStepUp).toHaveBeenCalledWith(
      'adm_sess_target',
      'Suspicious evidence access pattern.',
    );
    expect(audit.record).toHaveBeenCalledWith({
      actorId: 'super_1',
      actorRole: 'super_admin',
      action: 'admin.session_step_up_required',
      targetType: 'admin_session',
      targetId: 'adm_sess_target',
      metadata: {
        targetAdminId: 'admin_2',
        targetDeviceId: 'device_2',
        reason: 'Suspicious evidence access pattern.',
      },
    });
  });

  it('completes dev step-up for the current session and audits it', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    const adminSessions = {
      completeStepUp: jest.fn().mockResolvedValue({
        id: 'adm_sess_current',
        adminId: 'super_1',
        deviceId: 'device_current',
        mfaVerifiedAt: '2026-06-19T03:30:00.000Z',
        expiresAt: '2026-06-26T03:00:00.000Z',
        createdAt: '2026-06-19T03:00:00.000Z',
      }),
    };
    const audit = auditMock();
    const controller = new AdminAuthController({} as never, adminSessions as never, audit as never);

    await expect(
      controller.devCompleteStepUp(principal, { secret: 'dev-admin-secret' }),
    ).resolves.toEqual({
      stepUpCompleted: true,
      sessionId: 'adm_sess_current',
      mfaVerifiedAt: '2026-06-19T03:30:00.000Z',
    });

    expect(adminSessions.completeStepUp).toHaveBeenCalledWith(principal);
    expect(audit.record).toHaveBeenCalledWith({
      actorId: 'super_1',
      actorRole: 'super_admin',
      action: 'admin.session_step_up_completed',
      targetType: 'admin_session',
      targetId: 'adm_sess_current',
      metadata: { deviceId: 'device_current' },
    });
    process.env.NODE_ENV = originalEnv;
  });
});

function auditMock() {
  return { record: jest.fn(), assertHealthyForSensitiveAction: jest.fn() };
}

function auditMockWithDegradedHealth() {
  return {
    record: jest.fn(),
    assertHealthyForSensitiveAction: jest.fn().mockImplementation(() => {
      throw new AuditHealthError('Audit log is degraded; sensitive admin action blocked', 'audit_degraded', {
        status: 'degraded',
        failedWriteCount: 1,
        recentFailures: [],
      });
    }),
  };
}
