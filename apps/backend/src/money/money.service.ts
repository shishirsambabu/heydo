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

export interface CreateEscrowHoldInput {
  gigId: string;
  assignmentId: string;
  amount: number;
  actorId: string;
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
}
