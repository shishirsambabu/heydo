import { AuditService } from '../common/audit/audit.service';
import { GiverProfileRepository } from '../identity/identity.repository';
import { VerificationService } from '../verification/verification.service';
import {
  InMemoryApplicationRepository,
  InMemoryAssignmentRepository,
  InMemoryCategoryRepository,
  InMemoryGigRepository,
  InMemorySafetyReportRepository,
} from './marketplace.repository';
import { MarketplaceError, MarketplaceService } from './marketplace.service';

function service(canApply: (workerId: string) => Promise<boolean> = async () => true) {
  const givers = new GiverProfileRepository();
  const audit = new AuditService();
  let id = 0;
  const svc = new MarketplaceService(
    new InMemoryCategoryRepository(),
    new InMemoryGigRepository(),
    new InMemoryApplicationRepository(),
    new InMemoryAssignmentRepository(),
    new InMemorySafetyReportRepository(),
    givers,
    { canApply } as Pick<VerificationService, 'canApply'> as VerificationService,
    audit,
    () => Date.parse('2026-06-17T10:00:00.000Z'),
    () => `fixed_${++id}`,
  );
  return { svc, givers, audit };
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
    const { svc, givers } = service();
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
  });
});
