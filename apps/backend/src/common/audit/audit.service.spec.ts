import { AuditService } from './audit.service';

describe('AuditService', () => {
  it('returns a scoped copy of matching audit records', () => {
    const audit = new AuditService();
    audit.record({
      actorId: 'giver_1',
      actorRole: 'giver',
      action: 'gig.posted',
      targetType: 'gig',
      targetId: 'gig_1',
      metadata: { gigId: 'gig_1' },
    });
    audit.record({
      actorId: 'fraud_admin',
      actorRole: 'fraud_analyst',
      action: 'safety.dispute_release_to_worker',
      targetType: 'safety_report',
      targetId: 'safe_1',
      metadata: { gigId: 'gig_1', decision: 'release' },
    });
    audit.record({
      actorId: 'giver_2',
      actorRole: 'giver',
      action: 'gig.posted',
      targetType: 'gig',
      targetId: 'gig_2',
      metadata: { gigId: 'gig_2' },
    });

    const gigRecords = audit.list({ metadata: { gigId: 'gig_1' } });
    expect(gigRecords.map((entry) => entry.action)).toEqual([
      'gig.posted',
      'safety.dispute_release_to_worker',
    ]);

    gigRecords[0].metadata = { changed: true };
    expect(audit.list({ targetType: 'gig', targetId: 'gig_1' })[0].metadata).toEqual({
      gigId: 'gig_1',
    });
  });
});
