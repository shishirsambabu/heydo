import { AuditService } from '../common/audit/audit.service';
import { GiverProfileRepository } from '../identity/identity.repository';
import { InMemoryMoneyRepository } from '../money/money.repository';
import { MoneyService } from '../money/money.service';
import { VerificationService } from '../verification/verification.service';
import {
  InMemoryApplicationRepository,
  InMemoryAssignmentRepository,
  InMemoryCategoryRepository,
  InMemoryEvidenceVaultRefRepository,
  InMemoryEscalationPackageRepository,
  InMemoryGigRepository,
  InMemorySafetyReportRepository,
} from './marketplace.repository';
import { MarketplaceError, MarketplaceService } from './marketplace.service';

function service(
  canApply: (workerId: string) => Promise<boolean> = async () => true,
  withMoney = false,
) {
  const givers = new GiverProfileRepository();
  const audit = new AuditService();
  const moneyRepo = new InMemoryMoneyRepository();
  const safetyReports = new InMemorySafetyReportRepository();
  const evidenceVaultRefs = new InMemoryEvidenceVaultRefRepository();
  let id = 0;
  const svc = new MarketplaceService(
    new InMemoryCategoryRepository(),
    new InMemoryGigRepository(),
    new InMemoryApplicationRepository(),
    new InMemoryAssignmentRepository(),
    safetyReports,
    evidenceVaultRefs,
    new InMemoryEscalationPackageRepository(),
    givers,
    { canApply } as Pick<VerificationService, 'canApply'> as VerificationService,
    audit,
    () => Date.parse('2026-06-17T10:00:00.000Z'),
    () => `fixed_${++id}`,
    withMoney
      ? new MoneyService(
          moneyRepo,
          audit,
          () => Date.parse('2026-06-17T10:00:00.000Z'),
          () => `money_${++id}`,
        )
      : undefined,
  );
  return { svc, givers, audit, moneyRepo, safetyReports, evidenceVaultRefs };
}

describe('MarketplaceService', () => {
  it('blocks unverified givers from posting gigs', async () => {
    const { svc, givers } = service();
    await givers.save({
      userId: 'giver_1',
      displayName: 'Giver',
      status: 'active',
      verificationStatus: 'pending_review',
      createdAt: '2026-06-17T10:00:00.000Z',
    });

    await expect(
      svc.postGig('giver_1', {
        categoryId: 'cat_plumbing',
        title: 'Pipe leak repair',
        description: 'Kitchen pipe is leaking and needs repair',
        location: 'Thrissur',
        scheduledAt: '2026-06-18T10:00:00.000Z',
        budgetAmount: 1000,
      }),
    ).rejects.toMatchObject<Partial<MarketplaceError>>({
      code: 'giver_kyc_required',
    });
  });

  it('holds underpriced gigs for admin review instead of publishing unfair work', async () => {
    const { svc, givers } = service();
    await givers.save({
      userId: 'giver_1',
      displayName: 'Giver',
      status: 'active',
      verificationStatus: 'approved',
      createdAt: '2026-06-17T10:00:00.000Z',
    });

    const gig = await svc.postGig('giver_1', {
      categoryId: 'cat_cleaning',
      title: 'House cleaning',
      description: 'Need cleaning help for a family home',
      location: 'Kochi',
      scheduledAt: '2026-06-18T10:00:00.000Z',
      budgetAmount: 300,
    });

    expect(gig.visibilityStatus).toBe('pending_review');
    expect(gig.safetyFlags).toContain('budget_below_fair_minimum');
    await expect(svc.listGigs()).resolves.toEqual([]);
  });

  it('blocks unverified workers from applying to gigs', async () => {
    const { svc, givers } = service(async () => false);
    await givers.save({
      userId: 'giver_1',
      displayName: 'Giver',
      status: 'active',
      verificationStatus: 'approved',
      createdAt: '2026-06-17T10:00:00.000Z',
    });
    const gig = await svc.postGig('giver_1', {
      categoryId: 'cat_plumbing',
      title: 'Pipe leak repair',
      description: 'Kitchen pipe is leaking and needs repair',
      location: 'Thrissur',
      scheduledAt: '2026-06-18T10:00:00.000Z',
      budgetAmount: 1000,
    });

    await expect(
      svc.apply(gig.id, 'worker_unverified', { messageMl: 'ഞാൻ വരാം' }),
    ).rejects.toMatchObject<Partial<MarketplaceError>>({
      code: 'worker_not_verified',
    });
  });

  it('holds suspicious gigs for review and blocks worker applications until approval', async () => {
    const { svc, givers } = service();
    await givers.save({
      userId: 'giver_1',
      displayName: 'Giver',
      status: 'active',
      verificationStatus: 'approved',
      createdAt: '2026-06-17T10:00:00.000Z',
    });
    const gig = await svc.postGig('giver_1', {
      categoryId: 'cat_cleaning',
      title: 'Late night cleaning',
      description: 'Need cleaning help late night alone at a quiet house',
      location: 'Kochi',
      scheduledAt: '2026-06-18T10:00:00.000Z',
      budgetAmount: 1000,
    });

    expect(gig.visibilityStatus).toBe('pending_review');
    expect(gig.riskLevel).toBe('medium');
    expect(gig.safetyFlags).toContain('unsafe_or_isolating');
    await expect(svc.listGigs()).resolves.toEqual([]);
    await expect(svc.apply(gig.id, 'worker_1', { messageMl: 'ഞാൻ വരാം' })).rejects.toMatchObject({
      code: 'gig_not_visible',
    });

    await expect(svc.moderateGig(gig.id, 'fraud_admin', 'approve', 'Called giver')).resolves.toMatchObject({
      visibilityStatus: 'visible',
      moderatedBy: 'fraud_admin',
    });
    await expect(svc.apply(gig.id, 'worker_1', { messageMl: 'ഇപ്പോൾ സുരക്ഷിതമാണ്' })).resolves.toMatchObject({
      status: 'applied',
    });
  });

  it('auto-rejects clearly unsafe gig requests', async () => {
    const { svc, givers } = service();
    await givers.save({
      userId: 'giver_1',
      displayName: 'Giver',
      status: 'active',
      verificationStatus: 'approved',
      createdAt: '2026-06-17T10:00:00.000Z',
    });
    const gig = await svc.postGig('giver_1', {
      categoryId: 'cat_event_help',
      title: 'Private service',
      description: 'Need adult service for a private party',
      location: 'Kochi',
      scheduledAt: '2026-06-18T10:00:00.000Z',
      budgetAmount: 5000,
    });

    expect(gig.visibilityStatus).toBe('rejected');
    expect(gig.riskLevel).toBe('high');
    expect(gig.safetyFlags).toContain('sexual_or_exploitative');
    await expect(svc.listGigsForAdmin({ visibilityStatus: 'rejected' })).resolves.toHaveLength(1);
  });

  it('records structured decision metadata for high-impact gig moderation', async () => {
    const { svc, givers, audit } = service();
    await givers.save({
      userId: 'giver_1',
      displayName: 'Giver',
      status: 'active',
      verificationStatus: 'approved',
      createdAt: '2026-06-17T10:00:00.000Z',
    });
    const gig = await svc.postGig('giver_1', {
      categoryId: 'cat_cleaning',
      title: 'Late night cleaning',
      description: 'Need cleaning help late night alone at a quiet house',
      location: 'Kochi',
      scheduledAt: '2026-06-18T10:00:00.000Z',
      budgetAmount: 1000,
    });

    await svc.moderateGig(
      gig.id,
      'fraud_admin',
      'approve',
      'Called giver and verified the safe scope.',
      {
        reasonCode: 'caller_verified_scope',
        note: 'Called giver and verified the safe scope.',
      },
    );

    await expect(audit.list({ targetType: 'gig', targetId: gig.id })).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'gig.moderation_approve',
          metadata: expect.objectContaining({
            decision: {
              reasonCode: 'caller_verified_scope',
              noteLength: 41,
            },
          }),
        }),
      ]),
    );
    const moderationAudit = (await audit.list({ targetType: 'gig', targetId: gig.id })).find(
      (entry) => entry.action === 'gig.moderation_approve',
    );
    expect(JSON.stringify(moderationAudit?.metadata)).not.toContain(
      'Called giver and verified the safe scope.',
    );
  });

  it('lets users raise a serious safety report that flags the gig for admin action', async () => {
    const { svc, givers } = service();
    await givers.save({
      userId: 'giver_1',
      displayName: 'Giver',
      status: 'active',
      verificationStatus: 'approved',
      createdAt: '2026-06-17T10:00:00.000Z',
    });
    const gig = await svc.postGig('giver_1', {
      categoryId: 'cat_cleaning',
      title: 'House cleaning',
      description: 'Need cleaning help for a family home',
      location: 'Kochi',
      scheduledAt: '2026-06-18T10:00:00.000Z',
      budgetAmount: 1000,
    });

    const report = await svc.raiseSafetyReport(gig.id, 'worker_1', {
      reportedUserId: 'giver_1',
      reason: 'sexual_misconduct',
      severity: 'critical',
      description: 'Giver asked for sexual favours in chat.',
      evidenceVaultRefs: ['vault_chat_1'],
    });

    expect(report.status).toBe('open');
    expect(report.evidenceVaultRefs).toEqual(['vault_chat_1']);
    await expect(
      svc.listSafetyReportEvidenceRefs(report.id, 'fraud_admin', ['fraud_analyst']),
    ).resolves.toEqual([
      expect.objectContaining({
        ref: 'vault_chat_1',
        classification: 'chat',
        retentionPolicy: 'legal_hold',
        legalHold: true,
        allowedRoles: ['fraud_analyst', 'dispute_officer', 'super_admin'],
        accessCount: 1,
        lastAccessedBy: 'fraud_admin',
      }),
    ]);
    await expect(
      svc.listSafetyReportEvidenceRefs(report.id, 'support_admin', ['support']),
    ).rejects.toMatchObject<Partial<MarketplaceError>>({
      code: 'forbidden',
    });
    await expect(svc.getGig(gig.id)).resolves.toMatchObject({
      visibilityStatus: 'flagged',
      riskLevel: 'high',
      safetyFlags: expect.arrayContaining(['sexual_misconduct']),
    });
    await expect(svc.listSafetyReports({ status: 'open' })).resolves.toHaveLength(1);
    await expect(
      svc.reviewSafetyReport(
        report.id,
        'fraud_admin',
        'escalated',
        'Preserved evidence and prepared lawful escalation package',
        'POLICE_DD_001',
      ),
    ).resolves.toMatchObject({
      status: 'escalated',
      reviewedBy: 'fraud_admin',
      lawEnforcementRef: 'POLICE_DD_001',
    });
  });

  it('runs post -> apply -> choose -> start -> complete', async () => {
    const { svc, givers, moneyRepo } = service(async () => true, true);
    await givers.save({
      userId: 'giver_1',
      displayName: 'Giver',
      status: 'active',
      verificationStatus: 'approved',
      createdAt: '2026-06-17T10:00:00.000Z',
    });
    const gig = await svc.postGig('giver_1', {
      categoryId: 'cat_mehendi',
      title: 'Wedding mehendi',
      description: 'Need a mehendi artist for a small family function',
      location: 'Kochi',
      scheduledAt: '2026-06-19T10:00:00.000Z',
      budgetAmount: 2500,
    });
    const first = await svc.apply(gig.id, 'worker_1', {
      messageMl: 'ഞാൻ ചെയ്യാം',
      proposedPrice: 3200,
    });
    const second = await svc.apply(gig.id, 'worker_2', { messageMl: 'സമയം ശരിയാണ്' });

    const selected = await svc.selectApplicant(gig.id, first.id, 'giver_1');
    expect(selected.gig.status).toBe('assigned');
    expect(selected.assignment.workerId).toBe('worker_1');
    expect(selected.assignment).toMatchObject({
      agreedAmount: 3200,
      platformFeeAmount: 480,
      workerPayoutAmount: 2720,
    });
    const hold = await moneyRepo.findEscrowHoldByGig(gig.id);
    expect(hold).toMatchObject({
      amount: 3200,
      status: 'held',
    });
    expect(selected.applications).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: first.id, proposedPrice: 3200 })]),
    );
    expect(selected.applications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: first.id, status: 'selected' }),
        expect.objectContaining({ id: second.id, status: 'rejected' }),
      ]),
    );

    await expect(svc.transitionGig(gig.id, 'worker_2', 'in_progress')).rejects.toMatchObject({
      code: 'forbidden',
    });
    await expect(svc.transitionGig(gig.id, 'worker_1', 'in_progress')).resolves.toMatchObject({
      status: 'in_progress',
    });
    await expect(svc.transitionGig(gig.id, 'giver_1', 'completed')).resolves.toMatchObject({
      status: 'completed',
    });
    await expect(moneyRepo.findEscrowHoldByGig(gig.id)).resolves.toMatchObject({
      amount: 3200,
      status: 'released',
    });
    await expect(svc.transitionGig(gig.id, 'giver_1', 'cancelled')).rejects.toMatchObject({
      code: 'invalid_state',
    });
  });

  it('refunds held escrow when an assigned gig is cancelled', async () => {
    const { svc, givers, moneyRepo } = service(async () => true, true);
    await givers.save({
      userId: 'giver_1',
      displayName: 'Giver',
      status: 'active',
      verificationStatus: 'approved',
      createdAt: '2026-06-17T10:00:00.000Z',
    });
    const gig = await svc.postGig('giver_1', {
      categoryId: 'cat_cleaning',
      title: 'House cleaning',
      description: 'Need cleaning help for a family home',
      location: 'Kochi',
      scheduledAt: '2026-06-19T10:00:00.000Z',
      budgetAmount: 1000,
    });
    const application = await svc.apply(gig.id, 'worker_1', {
      messageMl: 'I can help',
      proposedPrice: 1200,
    });

    await svc.selectApplicant(gig.id, application.id, 'giver_1');
    await expect(moneyRepo.findEscrowHoldByGig(gig.id)).resolves.toMatchObject({
      amount: 1200,
      status: 'held',
    });

    await expect(svc.transitionGig(gig.id, 'worker_1', 'cancelled')).resolves.toMatchObject({
      status: 'cancelled',
    });
    await expect(moneyRepo.findEscrowHoldByGig(gig.id)).resolves.toMatchObject({
      amount: 1200,
      status: 'refunded',
    });
  });

  it('freezes held escrow when a serious safety report is raised after assignment', async () => {
    const { svc, givers, moneyRepo } = service(async () => true, true);
    await givers.save({
      userId: 'giver_1',
      displayName: 'Giver',
      status: 'active',
      verificationStatus: 'approved',
      createdAt: '2026-06-17T10:00:00.000Z',
    });
    const gig = await svc.postGig('giver_1', {
      categoryId: 'cat_cleaning',
      title: 'House cleaning',
      description: 'Need cleaning help for a family home',
      location: 'Kochi',
      scheduledAt: '2026-06-19T10:00:00.000Z',
      budgetAmount: 1000,
    });
    const application = await svc.apply(gig.id, 'worker_1', {
      messageMl: 'I can help',
      proposedPrice: 1200,
    });
    await svc.selectApplicant(gig.id, application.id, 'giver_1');
    await svc.transitionGig(gig.id, 'worker_1', 'in_progress');

    await expect(
      svc.raiseSafetyReport(gig.id, 'worker_1', {
        reportedUserId: 'giver_1',
        reason: 'violence_or_threat',
        severity: 'high',
        description: 'Giver threatened me after assignment.',
        evidenceVaultRefs: ['vault_chat_2'],
      }),
    ).resolves.toMatchObject({ status: 'open' });
    await expect(moneyRepo.findEscrowHoldByGig(gig.id)).resolves.toMatchObject({
      amount: 1200,
      status: 'disputed',
    });
    await expect(svc.transitionGig(gig.id, 'giver_1', 'completed')).rejects.toThrow(
      'Cannot release escrow in status disputed',
    );
    await expect(svc.transitionGig(gig.id, 'worker_1', 'cancelled')).rejects.toThrow(
      'Cannot refund escrow in status disputed',
    );
  });

  it('lets admin resolve a disputed escrow by releasing funds to the worker', async () => {
    const { svc, givers, moneyRepo } = service(async () => true, true);
    await givers.save({
      userId: 'giver_1',
      displayName: 'Giver',
      status: 'active',
      verificationStatus: 'approved',
      createdAt: '2026-06-17T10:00:00.000Z',
    });
    const gig = await svc.postGig('giver_1', {
      categoryId: 'cat_cleaning',
      title: 'House cleaning',
      description: 'Need cleaning help for a family home',
      location: 'Kochi',
      scheduledAt: '2026-06-19T10:00:00.000Z',
      budgetAmount: 1000,
    });
    const application = await svc.apply(gig.id, 'worker_1', {
      messageMl: 'I can help',
      proposedPrice: 1200,
    });
    await svc.selectApplicant(gig.id, application.id, 'giver_1');
    await svc.transitionGig(gig.id, 'worker_1', 'in_progress');
    const report = await svc.raiseSafetyReport(gig.id, 'worker_1', {
      reportedUserId: 'giver_1',
      reason: 'violence_or_threat',
      severity: 'high',
      description: 'Giver threatened me after assignment.',
      evidenceVaultRefs: ['vault_chat_2'],
    });

    await expect(
      svc.resolveSafetyDispute(
        report.id,
        'fraud_admin',
        'release_to_worker',
        'Evidence supports worker payment',
      ),
    ).resolves.toMatchObject({ status: 'action_taken', reviewedBy: 'fraud_admin' });
    await expect(moneyRepo.findEscrowHoldByGig(gig.id)).resolves.toMatchObject({
      amount: 1200,
      status: 'released',
    });
    await expect(svc.getGig(gig.id)).resolves.toMatchObject({ status: 'completed' });
  });

  it('lets admin resolve a disputed escrow by refunding the giver', async () => {
    const { svc, givers, moneyRepo } = service(async () => true, true);
    await givers.save({
      userId: 'giver_1',
      displayName: 'Giver',
      status: 'active',
      verificationStatus: 'approved',
      createdAt: '2026-06-17T10:00:00.000Z',
    });
    const gig = await svc.postGig('giver_1', {
      categoryId: 'cat_cleaning',
      title: 'House cleaning',
      description: 'Need cleaning help for a family home',
      location: 'Kochi',
      scheduledAt: '2026-06-19T10:00:00.000Z',
      budgetAmount: 1000,
    });
    const application = await svc.apply(gig.id, 'worker_1', {
      messageMl: 'I can help',
      proposedPrice: 1200,
    });
    await svc.selectApplicant(gig.id, application.id, 'giver_1');
    await svc.transitionGig(gig.id, 'worker_1', 'in_progress');
    const report = await svc.raiseSafetyReport(gig.id, 'giver_1', {
      reportedUserId: 'worker_1',
      reason: 'fraud',
      severity: 'high',
      description: 'Worker did not arrive and asked for payment outside the app.',
      evidenceVaultRefs: ['vault_chat_3'],
    });

    await expect(
      svc.resolveSafetyDispute(
        report.id,
        'fraud_admin',
        'refund_giver',
        'Evidence supports refund to giver',
      ),
    ).resolves.toMatchObject({ status: 'action_taken', reviewedBy: 'fraud_admin' });
    await expect(moneyRepo.findEscrowHoldByGig(gig.id)).resolves.toMatchObject({
      amount: 1200,
      status: 'refunded',
    });
    await expect(svc.getGig(gig.id)).resolves.toMatchObject({ status: 'cancelled' });
  });

  it('generates a lawful escalation package for serious safety reports', async () => {
    const { svc, givers, moneyRepo, safetyReports } = service(async () => true, true);
    await givers.save({
      userId: 'giver_1',
      displayName: 'Giver',
      status: 'active',
      verificationStatus: 'approved',
      createdAt: '2026-06-17T10:00:00.000Z',
    });
    const gig = await svc.postGig('giver_1', {
      categoryId: 'cat_cleaning',
      title: 'House cleaning',
      description: 'Need cleaning help for a family home',
      location: 'Kochi',
      scheduledAt: '2026-06-19T10:00:00.000Z',
      budgetAmount: 1000,
    });
    const application = await svc.apply(gig.id, 'worker_1', {
      messageMl: 'I can help',
      proposedPrice: 1200,
    });
    await svc.selectApplicant(gig.id, application.id, 'giver_1');
    await svc.transitionGig(gig.id, 'worker_1', 'in_progress');
    const report = await svc.raiseSafetyReport(gig.id, 'worker_1', {
      reportedUserId: 'giver_1',
      reason: 'violence_or_threat',
      severity: 'high',
      description: 'Giver threatened me after assignment.',
      evidenceVaultRefs: ['vault_chat_2', 'vault_audio_1'],
    });

    const pkg = await svc.generateSafetyEscalationPackage(report.id, 'fraud_admin');

    expect(pkg).toMatchObject({
      purpose: 'lawful_safety_escalation',
      generatedBy: 'fraud_admin',
      manifest: expect.objectContaining({
        reportId: report.id,
        gigId: gig.id,
        generatedBy: 'fraud_admin',
        snapshotSchemaVersion: 1,
        snapshotHash: expect.any(String),
        retrievalCount: 0,
      }),
      report: expect.objectContaining({ id: report.id, reason: 'violence_or_threat' }),
      gig: expect.objectContaining({ id: gig.id, giverId: 'giver_1' }),
      assignment: expect.objectContaining({ workerId: 'worker_1', agreedAmount: 1200 }),
      evidenceVaultRefs: ['vault_chat_2', 'vault_audio_1'],
      integrity: {
        algorithm: 'sha256',
        snapshotSchemaVersion: 1,
        snapshotHash: expect.any(String),
        verified: true,
        verifiedAt: '2026-06-17T10:00:00.000Z',
      },
      piiPolicy: {
        rawAadhaarStored: false,
        rawSelfieIncluded: false,
        evidenceRefsOnly: true,
      },
    });
    expect(pkg.auditTrail.map((entry) => entry.action)).toEqual(
      expect.arrayContaining([
        'gig.posted',
        'gig.worker_selected',
        'gig.in_progress',
        'safety.report_raised',
        'escrow.dispute_opened',
      ]),
    );
    expect(pkg.moneyTrail?.hold).toMatchObject({ amount: 1200, status: 'disputed' });
    await expect(moneyRepo.findEscrowHoldByGig(gig.id)).resolves.toMatchObject({
      amount: 1200,
      status: 'disputed',
    });

    const retrieved = await svc.retrieveSafetyEscalationPackage(pkg.id, 'fraud_admin_2');
    expect(retrieved.id).toBe(pkg.id);
    expect(retrieved.integrity).toMatchObject({
      snapshotHash: pkg.integrity.snapshotHash,
      verified: true,
    });
    expect(retrieved.manifest).toMatchObject({
      retrievalCount: 1,
      lastRetrievedBy: 'fraud_admin_2',
    });
    expect(retrieved.evidenceVaultRefs).toEqual(['vault_chat_2', 'vault_audio_1']);

    await safetyReports.save({ ...report, description: 'Tampered report body.' });
    const tampered = await svc.retrieveSafetyEscalationPackage(pkg.id, 'fraud_admin_3');
    expect(tampered.integrity).toMatchObject({
      snapshotHash: pkg.integrity.snapshotHash,
      verified: false,
    });
    expect(tampered.manifest).toMatchObject({
      retrievalCount: 2,
      lastRetrievedBy: 'fraud_admin_3',
    });
  });
});
