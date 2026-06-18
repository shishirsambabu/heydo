import { randomBytes } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { AuditService } from '../common/audit/audit.service';
import {
  Account,
  EscrowHold,
  LedgerPosting,
  LedgerTransaction,
} from './money.entities';
import { MONEY_REPOSITORY, MoneyRepository } from './money.repository';

export interface MoneyTrailPosting extends LedgerPosting {
  account: Account | null;
}

export interface MoneyTrailTransaction {
  transaction: LedgerTransaction;
  postings: MoneyTrailPosting[];
}

export interface GigMoneyTrail {
  hold: EscrowHold | null;
  transactions: MoneyTrailTransaction[];
}

export interface CreateEscrowHoldInput {
  gigId: string;
  assignmentId: string;
  amount: number;
  actorId: string;
}

export interface ReleaseEscrowInput {
  gigId: string;
  assignmentId: string;
  workerId: string;
  agreedAmount: number;
  platformFeeAmount: number;
  workerPayoutAmount: number;
  actorId: string;
}

export interface RefundEscrowInput {
  gigId: string;
  assignmentId: string;
  amount: number;
  actorId: string;
  actorRole: 'giver' | 'worker';
}

export interface OpenEscrowDisputeInput {
  gigId: string;
  assignmentId: string;
  reportId: string;
  actorId: string;
  actorRole: 'giver' | 'worker' | 'fraud_analyst' | 'system';
  reason: string;
}

export interface ResolveDisputedEscrowReleaseInput extends ReleaseEscrowInput {
  reportId: string;
  reviewerId: string;
}

export interface ResolveDisputedEscrowRefundInput {
  gigId: string;
  assignmentId: string;
  reportId: string;
  amount: number;
  reviewerId: string;
}

@Injectable()
export class MoneyService {
  constructor(
    @Inject(MONEY_REPOSITORY) private readonly repo: MoneyRepository,
    private readonly audit: AuditService,
    private readonly now: () => number = () => Date.now(),
    private readonly id: () => string = () => randomBytes(10).toString('hex'),
  ) {}

  async createEscrowHold(input: CreateEscrowHoldInput): Promise<{
    hold: EscrowHold;
    transaction: LedgerTransaction;
    postings: LedgerPosting[];
  }> {
    if (input.amount <= 0) throw new Error('Escrow amount must be positive');
    const idempotencyKey = `escrow_hold:${input.gigId}:${input.assignmentId}`;
    const existing = await this.repo.findTransactionByIdempotencyKey(idempotencyKey);
    if (existing) {
      const existingHold = await this.repo.findEscrowHoldByGig(input.gigId);
      return {
        hold: existingHold!,
        transaction: existing,
        postings: await this.repo.listPostings(existing.id),
      };
    }

    const escrowCash = await this.findOrCreateAccount('system', 'heydo', 'escrow_cash');
    const escrowPayable = await this.findOrCreateAccount('gig', input.gigId, 'escrow_payable');
    const createdAt = new Date(this.now()).toISOString();
    const transaction: LedgerTransaction = {
      id: `txn_${this.id()}`,
      type: 'escrow_hold',
      gigId: input.gigId,
      idempotencyKey,
      status: 'posted',
      createdAt,
    };
    const postings: LedgerPosting[] = [
      {
        id: `post_${this.id()}`,
        transactionId: transaction.id,
        accountId: escrowCash.id,
        direction: 'debit',
        amount: input.amount,
        currency: 'INR',
      },
      {
        id: `post_${this.id()}`,
        transactionId: transaction.id,
        accountId: escrowPayable.id,
        direction: 'credit',
        amount: input.amount,
        currency: 'INR',
      },
    ];
    await this.repo.saveTransaction(transaction, postings);

    const hold: EscrowHold = {
      id: `hold_${this.id()}`,
      gigId: input.gigId,
      amount: input.amount,
      status: 'held',
      providerRef: 'dev-ledger-only',
      createdAt,
    };
    await this.repo.saveEscrowHold(hold);
    this.audit.record({
      actorId: input.actorId,
      actorRole: 'giver',
      action: 'escrow.hold_created',
      targetType: 'gig',
      targetId: input.gigId,
      metadata: {
        assignmentId: input.assignmentId,
        transactionId: transaction.id,
        amount: input.amount,
        providerRef: hold.providerRef,
      },
    });
    return { hold, transaction, postings };
  }

  async moneyTrailForGig(gigId: string): Promise<GigMoneyTrail> {
    const hold = await this.repo.findEscrowHoldByGig(gigId);
    const transactions = await this.repo.listTransactionsByGig(gigId);
    return {
      hold,
      transactions: await Promise.all(
        transactions.map(async (transaction) => ({
          transaction,
          postings: await this.postingsWithAccounts(transaction.id),
        })),
      ),
    };
  }

  async releaseEscrow(input: ReleaseEscrowInput): Promise<{
    hold: EscrowHold;
    transaction: LedgerTransaction;
    postings: LedgerPosting[];
  }> {
    if (input.agreedAmount <= 0) throw new Error('Escrow release amount must be positive');
    if (input.platformFeeAmount + input.workerPayoutAmount !== input.agreedAmount) {
      throw new Error('Escrow release split must equal agreed amount');
    }
    const idempotencyKey = `escrow_release:${input.gigId}:${input.assignmentId}`;
    const existing = await this.repo.findTransactionByIdempotencyKey(idempotencyKey);
    if (existing) {
      const existingHold = await this.repo.findEscrowHoldByGig(input.gigId);
      return {
        hold: existingHold!,
        transaction: existing,
        postings: await this.repo.listPostings(existing.id),
      };
    }

    const hold = await this.repo.findEscrowHoldByGig(input.gigId);
    if (!hold) throw new Error('Cannot release escrow before hold exists');
    if (hold.status !== 'held') throw new Error(`Cannot release escrow in status ${hold.status}`);
    if (hold.amount !== input.agreedAmount) {
      throw new Error('Escrow hold amount does not match assignment amount');
    }

    const escrowPayable = await this.findOrCreateAccount('gig', input.gigId, 'escrow_payable');
    const workerPayable = await this.findOrCreateAccount('worker', input.workerId, 'worker_payable');
    const platformRevenue = await this.findOrCreateAccount('platform', 'heydo', 'platform_revenue');
    const createdAt = new Date(this.now()).toISOString();
    const transaction: LedgerTransaction = {
      id: `txn_${this.id()}`,
      type: 'escrow_release',
      gigId: input.gigId,
      idempotencyKey,
      status: 'posted',
      createdAt,
    };
    const postings: LedgerPosting[] = [
      {
        id: `post_${this.id()}`,
        transactionId: transaction.id,
        accountId: escrowPayable.id,
        direction: 'debit',
        amount: input.agreedAmount,
        currency: 'INR',
      },
      {
        id: `post_${this.id()}`,
        transactionId: transaction.id,
        accountId: workerPayable.id,
        direction: 'credit',
        amount: input.workerPayoutAmount,
        currency: 'INR',
      },
      {
        id: `post_${this.id()}`,
        transactionId: transaction.id,
        accountId: platformRevenue.id,
        direction: 'credit',
        amount: input.platformFeeAmount,
        currency: 'INR',
      },
    ];
    await this.repo.saveTransaction(transaction, postings);

    const released: EscrowHold = { ...hold, status: 'released' };
    await this.repo.saveEscrowHold(released);
    this.audit.record({
      actorId: input.actorId,
      actorRole: 'giver',
      action: 'escrow.released',
      targetType: 'gig',
      targetId: input.gigId,
      metadata: {
        assignmentId: input.assignmentId,
        transactionId: transaction.id,
        agreedAmount: input.agreedAmount,
        workerPayoutAmount: input.workerPayoutAmount,
        platformFeeAmount: input.platformFeeAmount,
      },
    });
    return { hold: released, transaction, postings };
  }

  async refundEscrow(input: RefundEscrowInput): Promise<{
    hold: EscrowHold;
    transaction: LedgerTransaction;
    postings: LedgerPosting[];
  }> {
    if (input.amount <= 0) throw new Error('Escrow refund amount must be positive');
    const idempotencyKey = `escrow_refund:${input.gigId}:${input.assignmentId}`;
    const existing = await this.repo.findTransactionByIdempotencyKey(idempotencyKey);
    if (existing) {
      const existingHold = await this.repo.findEscrowHoldByGig(input.gigId);
      return {
        hold: existingHold!,
        transaction: existing,
        postings: await this.repo.listPostings(existing.id),
      };
    }

    const hold = await this.repo.findEscrowHoldByGig(input.gigId);
    if (!hold) throw new Error('Cannot refund escrow before hold exists');
    if (hold.status !== 'held') throw new Error(`Cannot refund escrow in status ${hold.status}`);
    if (hold.amount !== input.amount) {
      throw new Error('Escrow hold amount does not match refund amount');
    }

    const escrowPayable = await this.findOrCreateAccount('gig', input.gigId, 'escrow_payable');
    const escrowCash = await this.findOrCreateAccount('system', 'heydo', 'escrow_cash');
    const createdAt = new Date(this.now()).toISOString();
    const transaction: LedgerTransaction = {
      id: `txn_${this.id()}`,
      type: 'escrow_refund',
      gigId: input.gigId,
      idempotencyKey,
      status: 'posted',
      createdAt,
    };
    const postings: LedgerPosting[] = [
      {
        id: `post_${this.id()}`,
        transactionId: transaction.id,
        accountId: escrowPayable.id,
        direction: 'debit',
        amount: input.amount,
        currency: 'INR',
      },
      {
        id: `post_${this.id()}`,
        transactionId: transaction.id,
        accountId: escrowCash.id,
        direction: 'credit',
        amount: input.amount,
        currency: 'INR',
      },
    ];
    await this.repo.saveTransaction(transaction, postings);

    const refunded: EscrowHold = { ...hold, status: 'refunded' };
    await this.repo.saveEscrowHold(refunded);
    this.audit.record({
      actorId: input.actorId,
      actorRole: input.actorRole,
      action: 'escrow.refunded',
      targetType: 'gig',
      targetId: input.gigId,
      metadata: {
        assignmentId: input.assignmentId,
        transactionId: transaction.id,
        amount: input.amount,
      },
    });
    return { hold: refunded, transaction, postings };
  }

  async openEscrowDispute(input: OpenEscrowDisputeInput): Promise<{
    hold: EscrowHold;
    transaction: LedgerTransaction;
    postings: LedgerPosting[];
  }> {
    const idempotencyKey = `escrow_dispute:${input.gigId}:${input.assignmentId}`;
    const existing = await this.repo.findTransactionByIdempotencyKey(idempotencyKey);
    if (existing) {
      const existingHold = await this.repo.findEscrowHoldByGig(input.gigId);
      return {
        hold: existingHold!,
        transaction: existing,
        postings: await this.repo.listPostings(existing.id),
      };
    }

    const hold = await this.repo.findEscrowHoldByGig(input.gigId);
    if (!hold) throw new Error('Cannot dispute escrow before hold exists');
    if (hold.status !== 'held') throw new Error(`Cannot dispute escrow in status ${hold.status}`);

    const createdAt = new Date(this.now()).toISOString();
    const transaction: LedgerTransaction = {
      id: `txn_${this.id()}`,
      type: 'escrow_dispute_opened',
      gigId: input.gigId,
      idempotencyKey,
      status: 'posted',
      createdAt,
    };
    const postings: LedgerPosting[] = [];
    await this.repo.saveTransaction(transaction, postings);

    const disputed: EscrowHold = { ...hold, status: 'disputed' };
    await this.repo.saveEscrowHold(disputed);
    this.audit.record({
      actorId: input.actorId,
      actorRole: input.actorRole,
      action: 'escrow.dispute_opened',
      targetType: 'gig',
      targetId: input.gigId,
      metadata: {
        assignmentId: input.assignmentId,
        reportId: input.reportId,
        transactionId: transaction.id,
        reason: input.reason,
      },
    });
    return { hold: disputed, transaction, postings };
  }

  async releaseDisputedEscrow(input: ResolveDisputedEscrowReleaseInput): Promise<{
    hold: EscrowHold;
    transaction: LedgerTransaction;
    postings: LedgerPosting[];
  }> {
    if (input.agreedAmount <= 0) throw new Error('Disputed escrow release amount must be positive');
    if (input.platformFeeAmount + input.workerPayoutAmount !== input.agreedAmount) {
      throw new Error('Disputed escrow release split must equal agreed amount');
    }
    const idempotencyKey = `escrow_dispute_release:${input.gigId}:${input.assignmentId}`;
    const existing = await this.repo.findTransactionByIdempotencyKey(idempotencyKey);
    if (existing) {
      const existingHold = await this.repo.findEscrowHoldByGig(input.gigId);
      return {
        hold: existingHold!,
        transaction: existing,
        postings: await this.repo.listPostings(existing.id),
      };
    }

    const hold = await this.repo.findEscrowHoldByGig(input.gigId);
    if (!hold) throw new Error('Cannot resolve disputed escrow before hold exists');
    if (hold.status !== 'disputed') {
      throw new Error(`Cannot release disputed escrow in status ${hold.status}`);
    }
    if (hold.amount !== input.agreedAmount) {
      throw new Error('Escrow hold amount does not match disputed release amount');
    }

    const escrowPayable = await this.findOrCreateAccount('gig', input.gigId, 'escrow_payable');
    const workerPayable = await this.findOrCreateAccount('worker', input.workerId, 'worker_payable');
    const platformRevenue = await this.findOrCreateAccount('platform', 'heydo', 'platform_revenue');
    const createdAt = new Date(this.now()).toISOString();
    const transaction: LedgerTransaction = {
      id: `txn_${this.id()}`,
      type: 'escrow_dispute_release',
      gigId: input.gigId,
      idempotencyKey,
      status: 'posted',
      createdAt,
    };
    const postings: LedgerPosting[] = [
      {
        id: `post_${this.id()}`,
        transactionId: transaction.id,
        accountId: escrowPayable.id,
        direction: 'debit',
        amount: input.agreedAmount,
        currency: 'INR',
      },
      {
        id: `post_${this.id()}`,
        transactionId: transaction.id,
        accountId: workerPayable.id,
        direction: 'credit',
        amount: input.workerPayoutAmount,
        currency: 'INR',
      },
      {
        id: `post_${this.id()}`,
        transactionId: transaction.id,
        accountId: platformRevenue.id,
        direction: 'credit',
        amount: input.platformFeeAmount,
        currency: 'INR',
      },
    ];
    await this.repo.saveTransaction(transaction, postings);

    const released: EscrowHold = { ...hold, status: 'released' };
    await this.repo.saveEscrowHold(released);
    this.audit.record({
      actorId: input.reviewerId,
      actorRole: 'fraud_analyst',
      action: 'escrow.dispute_released',
      targetType: 'gig',
      targetId: input.gigId,
      metadata: {
        assignmentId: input.assignmentId,
        reportId: input.reportId,
        transactionId: transaction.id,
        agreedAmount: input.agreedAmount,
        workerPayoutAmount: input.workerPayoutAmount,
        platformFeeAmount: input.platformFeeAmount,
      },
    });
    return { hold: released, transaction, postings };
  }

  async refundDisputedEscrow(input: ResolveDisputedEscrowRefundInput): Promise<{
    hold: EscrowHold;
    transaction: LedgerTransaction;
    postings: LedgerPosting[];
  }> {
    if (input.amount <= 0) throw new Error('Disputed escrow refund amount must be positive');
    const idempotencyKey = `escrow_dispute_refund:${input.gigId}:${input.assignmentId}`;
    const existing = await this.repo.findTransactionByIdempotencyKey(idempotencyKey);
    if (existing) {
      const existingHold = await this.repo.findEscrowHoldByGig(input.gigId);
      return {
        hold: existingHold!,
        transaction: existing,
        postings: await this.repo.listPostings(existing.id),
      };
    }

    const hold = await this.repo.findEscrowHoldByGig(input.gigId);
    if (!hold) throw new Error('Cannot resolve disputed escrow before hold exists');
    if (hold.status !== 'disputed') {
      throw new Error(`Cannot refund disputed escrow in status ${hold.status}`);
    }
    if (hold.amount !== input.amount) {
      throw new Error('Escrow hold amount does not match disputed refund amount');
    }

    const escrowPayable = await this.findOrCreateAccount('gig', input.gigId, 'escrow_payable');
    const escrowCash = await this.findOrCreateAccount('system', 'heydo', 'escrow_cash');
    const createdAt = new Date(this.now()).toISOString();
    const transaction: LedgerTransaction = {
      id: `txn_${this.id()}`,
      type: 'escrow_dispute_refund',
      gigId: input.gigId,
      idempotencyKey,
      status: 'posted',
      createdAt,
    };
    const postings: LedgerPosting[] = [
      {
        id: `post_${this.id()}`,
        transactionId: transaction.id,
        accountId: escrowPayable.id,
        direction: 'debit',
        amount: input.amount,
        currency: 'INR',
      },
      {
        id: `post_${this.id()}`,
        transactionId: transaction.id,
        accountId: escrowCash.id,
        direction: 'credit',
        amount: input.amount,
        currency: 'INR',
      },
    ];
    await this.repo.saveTransaction(transaction, postings);

    const refunded: EscrowHold = { ...hold, status: 'refunded' };
    await this.repo.saveEscrowHold(refunded);
    this.audit.record({
      actorId: input.reviewerId,
      actorRole: 'fraud_analyst',
      action: 'escrow.dispute_refunded',
      targetType: 'gig',
      targetId: input.gigId,
      metadata: {
        assignmentId: input.assignmentId,
        reportId: input.reportId,
        transactionId: transaction.id,
        amount: input.amount,
      },
    });
    return { hold: refunded, transaction, postings };
  }

  private async findOrCreateAccount(
    ownerType: Account['ownerType'],
    ownerId: string,
    type: Account['type'],
  ): Promise<Account> {
    const existing = await this.repo.findAccount(ownerType, ownerId, type);
    if (existing) return existing;
    const account: Account = {
      id: `acct_${this.id()}`,
      ownerType,
      ownerId,
      type,
      currency: 'INR',
    };
    await this.repo.saveAccount(account);
    return account;
  }

  private async postingsWithAccounts(transactionId: string): Promise<MoneyTrailPosting[]> {
    const postings = await this.repo.listPostings(transactionId);
    return Promise.all(
      postings.map(async (posting) => ({
        ...posting,
        account: await this.repo.findAccountById(posting.accountId),
      })),
    );
  }
}
