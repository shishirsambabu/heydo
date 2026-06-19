import { AuditRecord, AuditService } from './audit.service';

describe('AuditService', () => {
  it('returns a scoped copy of matching audit records', async () => {
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

    const gigRecords = await audit.list({ metadata: { gigId: 'gig_1' } });
    expect(gigRecords.map((entry) => entry.action)).toEqual([
      'gig.posted',
      'safety.dispute_release_to_worker',
    ]);

    gigRecords[0].metadata = { changed: true };
    expect((await audit.list({ targetType: 'gig', targetId: 'gig_1' }))[0].metadata).toEqual({
      gigId: 'gig_1',
    });
  });

  it('surfaces failed audit writes through health', async () => {
    const audit = new AuditService({
      append: async () => {
        throw new Error('database unavailable');
      },
      list: async () => [],
    });

    audit.record({
      actorId: 'fraud_admin',
      actorRole: 'fraud_analyst',
      action: 'safety.dispute_refund_giver',
      targetType: 'safety_report',
      targetId: 'safe_1',
      metadata: { gigId: 'gig_1' },
    });
    await flushMicrotasks();

    expect(audit.health()).toMatchObject({
      status: 'degraded',
      failedWriteCount: 1,
      recentFailures: [
        expect.objectContaining({
          action: 'safety.dispute_refund_giver',
          targetType: 'safety_report',
          targetId: 'safe_1',
          error: 'database unavailable',
        }),
      ],
    });
  });

  it('blocks sensitive actions while audit writes are degraded', async () => {
    const audit = new AuditService({
      append: async () => {
        throw new Error('database unavailable');
      },
      list: async () => [],
    });

    audit.record({
      actorId: 'fraud_admin',
      actorRole: 'fraud_analyst',
      action: 'safety.escalated',
      targetType: 'safety_report',
      targetId: 'safe_1',
    });
    await flushMicrotasks();

    expect(() => audit.assertHealthyForSensitiveAction()).toThrow(
      'Audit log is degraded; sensitive admin action blocked',
    );
  });

  it('restores audit health only after writing a recovery record', async () => {
    let shouldFail = true;
    const records: AuditRecord[] = [];
    const audit = new AuditService({
      append: async (record) => {
        if (shouldFail) throw new Error('database unavailable');
        records.push(record);
      },
      list: async () => records,
    });

    audit.record({
      actorId: 'fraud_admin',
      actorRole: 'fraud_analyst',
      action: 'safety.escalated',
      targetType: 'safety_report',
      targetId: 'safe_1',
    });
    await flushMicrotasks();
    shouldFail = false;

    await expect(
      audit.restoreAfterInvestigation({
        actorId: 'super_admin',
        actorRole: 'super_admin',
        action: 'admin.audit_recovery_confirmed',
        targetType: 'audit_log',
        targetId: 'health',
        metadata: {
          reason: 'Database write path restored.',
          investigatedByAdminId: 'super_admin_2',
        },
      }),
    ).resolves.toMatchObject({ status: 'ok', failedWriteCount: 0 });

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      action: 'admin.audit_recovery_confirmed',
      metadata: expect.objectContaining({
        reason: 'Database write path restored.',
        investigatedByAdminId: 'super_admin_2',
        previousFailedWriteCount: 1,
      }),
    });
    expect(() => audit.assertHealthyForSensitiveAction()).not.toThrow();
  });

  it('keeps audit degraded when the recovery record cannot be written', async () => {
    const audit = new AuditService({
      append: async () => {
        throw new Error('database unavailable');
      },
      list: async () => [],
    });

    audit.record({
      actorId: 'fraud_admin',
      actorRole: 'fraud_analyst',
      action: 'safety.escalated',
      targetType: 'safety_report',
      targetId: 'safe_1',
    });
    await flushMicrotasks();

    await expect(
      audit.restoreAfterInvestigation({
        actorId: 'super_admin',
        actorRole: 'super_admin',
        action: 'admin.audit_recovery_confirmed',
        targetType: 'audit_log',
        targetId: 'health',
      }),
    ).rejects.toMatchObject({
      code: 'audit_degraded',
      health: expect.objectContaining({ status: 'degraded', failedWriteCount: 2 }),
    });
  });
});

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
