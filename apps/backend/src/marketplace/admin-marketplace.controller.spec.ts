import { ROLES_KEY } from '../auth/decorators';
import { AuthPrincipal } from '../auth/auth.types';
import { AdminSessionError } from '../auth/admin-session.service';
import { AuditHealthError } from '../common/audit/audit.service';
import { AdminMarketplaceController } from './admin-marketplace.controller';

const principal: AuthPrincipal = {
  sub: 'admin_1',
  kind: 'admin' as const,
  roles: ['fraud_analyst' as const],
  adminSessionId: 'adm_sess_1',
  adminMfaVerifiedAt: Date.now(),
  adminDeviceId: 'device_1',
};

describe('AdminMarketplaceController RBAC metadata', () => {
  const rolesFor = (handler: keyof AdminMarketplaceController) =>
    Reflect.getMetadata(ROLES_KEY, AdminMarketplaceController.prototype[handler]);

  it('defaults future routes to super admin only', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AdminMarketplaceController)).toEqual(['super_admin']);
  });

  it('keeps support out of sensitive money, evidence, and escalation routes', () => {
    expect(rolesFor('adminGigs')).toEqual([
      'support',
      'fraud_analyst',
      'dispute_officer',
      'super_admin',
    ]);
    expect(rolesFor('moneyTrail')).toEqual(['finance', 'dispute_officer', 'super_admin']);
    expect(rolesFor('auditHealth')).toEqual(['super_admin']);
    expect(rolesFor('decisionReasons')).toEqual([
      'fraud_analyst',
      'dispute_officer',
      'finance',
      'support',
      'super_admin',
    ]);
    expect(rolesFor('safetyReportEvidenceRefs')).toEqual([
      'fraud_analyst',
      'dispute_officer',
      'super_admin',
    ]);
    expect(rolesFor('resolveDispute')).toEqual(['dispute_officer', 'super_admin']);
    expect(rolesFor('escalationPackage')).toEqual([
      'fraud_analyst',
      'dispute_officer',
      'super_admin',
    ]);
    expect(rolesFor('retrieveEscalationPackage')).toEqual([
      'fraud_analyst',
      'dispute_officer',
      'super_admin',
    ]);
  });

  it('restricts moderation and safety review to trust operators', () => {
    const trustOperatorRoles = ['fraud_analyst', 'dispute_officer', 'super_admin'];

    expect(rolesFor('pendingReview')).toEqual(trustOperatorRoles);
    expect(rolesFor('approve')).toEqual(trustOperatorRoles);
    expect(rolesFor('reject')).toEqual(trustOperatorRoles);
    expect(rolesFor('flag')).toEqual(trustOperatorRoles);
    expect(rolesFor('reviewSafetyReport')).toEqual(trustOperatorRoles);
    expect(rolesFor('gigAuditTrail')).toEqual(trustOperatorRoles);
    expect(rolesFor('safetyReportAuditTrail')).toEqual(trustOperatorRoles);
  });
});

describe('AdminMarketplaceController sensitive read audit', () => {
  it('audits money trail reads without storing detailed money records in metadata', async () => {
    const audit = auditMock();
    const moneyTrail = {
      hold: { id: 'hold_1' },
      transactions: [{ id: 'txn_1' }, { id: 'txn_2' }],
    };
    const controller = new AdminMarketplaceController(
      {} as never,
      { moneyTrailForGig: jest.fn().mockResolvedValue(moneyTrail) } as never,
      audit as never,
      adminSessionsMock() as never,
    );

    await expect(controller.moneyTrail('gig_1', principal)).resolves.toBe(moneyTrail);

    expect(audit.record).toHaveBeenCalledWith({
      actorId: 'admin_1',
      actorRole: 'fraud_analyst',
      action: 'admin.money_trail_viewed',
      targetType: 'gig',
      targetId: 'gig_1',
      metadata: {
        holdPresent: true,
        transactionCount: 2,
      },
    });
  });

  it('audits gig audit trail reads after building the returned trail', async () => {
    const direct = auditEntry('audit_2', 'gig', 'gig_1', '2026-06-17T10:02:00.000Z');
    const linked = auditEntry('audit_1', 'safety_report', 'safe_1', '2026-06-17T10:01:00.000Z');
    const audit = auditMock([direct], [linked]);
    const controller = new AdminMarketplaceController(
      {} as never,
      {} as never,
      audit as never,
      adminSessionsMock() as never,
    );

    await expect(controller.gigAuditTrail('gig_1', principal)).resolves.toEqual([linked, direct]);

    expect(audit.record).toHaveBeenCalledWith({
      actorId: 'admin_1',
      actorRole: 'fraud_analyst',
      action: 'admin.gig_audit_trail_viewed',
      targetType: 'gig',
      targetId: 'gig_1',
      metadata: { auditRecordCount: 2 },
    });
  });

  it('audits safety report audit trail reads', async () => {
    const reportAudit = auditEntry(
      'audit_3',
      'safety_report',
      'safe_1',
      '2026-06-17T10:03:00.000Z',
    );
    const audit = auditMock([reportAudit]);
    const controller = new AdminMarketplaceController(
      {} as never,
      {} as never,
      audit as never,
      adminSessionsMock() as never,
    );

    await expect(controller.safetyReportAuditTrail('safe_1', principal)).resolves.toEqual([
      reportAudit,
    ]);

    expect(audit.record).toHaveBeenCalledWith({
      actorId: 'admin_1',
      actorRole: 'fraud_analyst',
      action: 'admin.safety_report_audit_trail_viewed',
      targetType: 'safety_report',
      targetId: 'safe_1',
      metadata: { auditRecordCount: 1 },
    });
  });
});

describe('AdminMarketplaceController structured decisions', () => {
  it('exposes the approved decision reason catalog', () => {
    const controller = new AdminMarketplaceController(
      {} as never,
      {} as never,
      auditMock() as never,
      adminSessionsMock() as never,
    );

    expect(controller.decisionReasons()).toMatchObject({
      'gig.approve': expect.arrayContaining([
        expect.objectContaining({ code: 'caller_verified_scope' }),
      ]),
      'dispute.release_to_worker': expect.arrayContaining([
        expect.objectContaining({ code: 'evidence_supports_worker_payment' }),
      ]),
      'escalation.generate': expect.arrayContaining([
        expect.objectContaining({ code: 'police_escalation_ready' }),
      ]),
    });
  });

  it('passes structured moderation decisions to the service', async () => {
    const marketplace = { moderateGig: jest.fn().mockResolvedValue({ id: 'gig_1' }) };
    const controller = new AdminMarketplaceController(
      marketplace as never,
      {} as never,
      auditMock() as never,
      adminSessionsMock() as never,
    );

    await controller.approve('gig_1', principal, {
      reasonCode: 'caller_verified_scope',
      note: 'Called giver and verified the safe scope.',
    });

    expect(marketplace.moderateGig).toHaveBeenCalledWith(
      'gig_1',
      'admin_1',
      'approve',
      'Called giver and verified the safe scope.',
      {
        reasonCode: 'caller_verified_scope',
        note: 'Called giver and verified the safe scope.',
      },
    );
  });

  it('rejects unsupported decision reasons before service calls', async () => {
    const marketplace = { moderateGig: jest.fn() };
    const controller = new AdminMarketplaceController(
      marketplace as never,
      {} as never,
      auditMock() as never,
      adminSessionsMock() as never,
    );

    await expect(
      controller.approve('gig_1', principal, {
        reasonCode: 'made_up_reason',
        note: 'This should not be allowed.',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'invalid_decision_reason' }),
    });
    expect(marketplace.moderateGig).not.toHaveBeenCalled();
  });

  it('requires law enforcement refs for catalog reasons that demand them', async () => {
    const marketplace = { reviewSafetyReport: jest.fn() };
    const controller = new AdminMarketplaceController(
      marketplace as never,
      {} as never,
      auditMock() as never,
      adminSessionsMock() as never,
    );

    await expect(
      controller.reviewSafetyReport('safe_1', principal, {
        status: 'escalated',
        reasonCode: 'lawful_police_escalation',
        note: 'Case needs police escalation.',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'law_enforcement_ref_required' }),
    });
    expect(marketplace.reviewSafetyReport).not.toHaveBeenCalled();

    await controller.reviewSafetyReport('safe_1', principal, {
      status: 'escalated',
      reasonCode: 'lawful_police_escalation',
      note: 'Case needs police escalation.',
      lawEnforcementRef: 'POLICE_DD_001',
    });

    expect(marketplace.reviewSafetyReport).toHaveBeenCalledWith(
      'safe_1',
      'admin_1',
      'escalated',
      'Case needs police escalation.',
      'POLICE_DD_001',
      {
        reasonCode: 'lawful_police_escalation',
        note: 'Case needs police escalation.',
      },
    );
  });

  it('requires a structured decision when generating escalation packages', async () => {
    const marketplace = {
      generateSafetyEscalationPackage: jest.fn().mockResolvedValue({ id: 'escpkg_1' }),
    };
    const controller = new AdminMarketplaceController(
      marketplace as never,
      {} as never,
      auditMock() as never,
      adminSessionsMock() as never,
    );

    await controller.escalationPackage('safe_1', principal, {
      reasonCode: 'police_escalation_ready',
      note: 'Evidence refs and money trail are ready for lawful escalation.',
    });

    expect(marketplace.generateSafetyEscalationPackage).toHaveBeenCalledWith(
      'safe_1',
      'admin_1',
      {
        reasonCode: 'police_escalation_ready',
        note: 'Evidence refs and money trail are ready for lawful escalation.',
      },
    );
  });
});

describe('AdminMarketplaceController fresh admin session gates', () => {
  it('blocks sensitive actions when audit writes are degraded', async () => {
    const marketplace = { moderateGig: jest.fn() };
    const controller = new AdminMarketplaceController(
      marketplace as never,
      {} as never,
      auditMockWithDegradedHealth() as never,
      adminSessionsMock() as never,
    );

    await expect(
      controller.approve('gig_1', principal, {
        reasonCode: 'caller_verified_scope',
        note: 'Called giver and verified the safe scope.',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'audit_degraded', failedWriteCount: 1 }),
    });
    expect(marketplace.moderateGig).not.toHaveBeenCalled();
  });

  it('blocks sensitive money reads when the registry rejects the admin session', async () => {
    const money = { moneyTrailForGig: jest.fn() };
    const adminSessions = adminSessionsMock('admin_fresh_verification_required');
    const controller = new AdminMarketplaceController(
      {} as never,
      money as never,
      auditMock() as never,
      adminSessions as never,
    );

    await expect(controller.moneyTrail('gig_1', principal)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'admin_fresh_verification_required' }),
    });
    expect(money.moneyTrailForGig).not.toHaveBeenCalled();
  });

  it('blocks evidence refs without a trusted admin device marker', async () => {
    const marketplace = { listSafetyReportEvidenceRefs: jest.fn() };
    const controller = new AdminMarketplaceController(
      marketplace as never,
      {} as never,
      auditMock() as never,
      adminSessionsMock('admin_fresh_verification_required') as never,
    );

    await expect(
      controller.safetyReportEvidenceRefs('safe_1', { ...principal, adminDeviceId: undefined }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'admin_fresh_verification_required' }),
    });
    expect(marketplace.listSafetyReportEvidenceRefs).not.toHaveBeenCalled();
  });

  it('blocks escalation packages before service calls when the session was revoked', async () => {
    const marketplace = { generateSafetyEscalationPackage: jest.fn() };
    const controller = new AdminMarketplaceController(
      marketplace as never,
      {} as never,
      auditMock() as never,
      adminSessionsMock('admin_session_revoked') as never,
    );

    await expect(
      controller.escalationPackage(
        'safe_1',
        principal,
        {
          reasonCode: 'police_escalation_ready',
          note: 'Evidence refs and money trail are ready for lawful escalation.',
        },
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'admin_session_revoked' }),
    });
    expect(marketplace.generateSafetyEscalationPackage).not.toHaveBeenCalled();
  });
});

function adminSessionsMock(
  rejectCode?:
    | 'admin_fresh_verification_required'
    | 'admin_session_untrusted'
    | 'admin_session_revoked'
    | 'admin_session_expired'
    | 'admin_step_up_required',
) {
  return {
    assertFresh: jest.fn().mockImplementation(() => {
      if (!rejectCode) return Promise.resolve();
      return Promise.reject(new AdminSessionError('Admin session rejected', rejectCode));
    }),
  };
}

function auditMock(...listResults: unknown[][]) {
  return {
    list: jest
      .fn()
      .mockImplementation(() => Promise.resolve(listResults.shift() ?? [])),
    record: jest.fn(),
    assertHealthyForSensitiveAction: jest.fn(),
  };
}

function auditMockWithDegradedHealth() {
  return {
    list: jest.fn().mockResolvedValue([]),
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

function auditEntry(id: string, targetType: string, targetId: string, at: string) {
  return {
    id,
    actorId: 'actor_1',
    actorRole: 'giver',
    action: 'test.action',
    targetType,
    targetId,
    at,
  };
}
