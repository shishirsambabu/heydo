import { ROLES_KEY } from '../auth/decorators';
import { AdminMarketplaceController } from './admin-marketplace.controller';

const principal = {
  sub: 'admin_1',
  kind: 'admin' as const,
  roles: ['fraud_analyst' as const],
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
    const controller = new AdminMarketplaceController({} as never, {} as never, audit as never);

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
    const controller = new AdminMarketplaceController({} as never, {} as never, audit as never);

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

function auditMock(...listResults: unknown[][]) {
  return {
    list: jest
      .fn()
      .mockImplementation(() => Promise.resolve(listResults.shift() ?? [])),
    record: jest.fn(),
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
