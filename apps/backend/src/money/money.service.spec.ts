import { AuditService } from '../common/audit/audit.service';
import { InMemoryMoneyRepository } from './money.repository';
import { MoneyService } from './money.service';

describe('MoneyService', () => {
  it('creates an idempotent balanced escrow hold ledger transaction', async () => {
    const repo = new InMemoryMoneyRepository();
    const audit = new AuditService();
    let id = 0;
    const money = new MoneyService(
      repo,
      audit,
      () => Date.parse('2026-06-18T10:00:00.000Z'),
      () => `fixed_${++id}`,
    );

    const first = await money.createEscrowHold({
      gigId: 'gig_1',
      assignmentId: 'asg_1',
      amount: 3200,
      actorId: 'giver_1',
    });
    const second = await money.createEscrowHold({
      gigId: 'gig_1',
      assignmentId: 'asg_1',
      amount: 3200,
      actorId: 'giver_1',
    });

    expect(second.transaction.id).toBe(first.transaction.id);
    expect(second.hold.id).toBe(first.hold.id);
    expect(first.postings).toHaveLength(2);
    expect(sum(first.postings, 'debit')).toBe(3200);
    expect(sum(first.postings, 'credit')).toBe(3200);
    expect(first.hold).toMatchObject({
      gigId: 'gig_1',
      amount: 3200,
      status: 'held',
      providerRef: 'dev-ledger-only',
    });
    expect(audit.entries().filter((entry) => entry.action === 'escrow.hold_created')).toHaveLength(1);
  });
});

function sum(postings: { direction: string; amount: number }[], direction: string) {
  return postings
    .filter((posting) => posting.direction === direction)
    .reduce((total, posting) => total + posting.amount, 0);
}
