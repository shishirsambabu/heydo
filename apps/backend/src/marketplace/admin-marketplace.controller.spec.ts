import { ROLES_KEY } from '../auth/decorators';
import { AdminMarketplaceController } from './admin-marketplace.controller';

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
