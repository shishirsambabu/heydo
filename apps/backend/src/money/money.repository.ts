import {
  Account,
  EscrowHold,
  LedgerPosting,
  LedgerTransaction,
} from './money.entities';

export interface MoneyRepository {
  findAccount(ownerType: Account['ownerType'], ownerId: string, type: Account['type']): Promise<Account | null>;
  findAccountById(id: string): Promise<Account | null>;
  saveAccount(account: Account): Promise<void>;
  findTransactionByIdempotencyKey(idempotencyKey: string): Promise<LedgerTransaction | null>;
  listTransactionsByGig(gigId: string): Promise<LedgerTransaction[]>;
  saveTransaction(transaction: LedgerTransaction, postings: LedgerPosting[]): Promise<void>;
  listPostings(transactionId: string): Promise<LedgerPosting[]>;
  findEscrowHoldByGig(gigId: string): Promise<EscrowHold | null>;
  saveEscrowHold(hold: EscrowHold): Promise<void>;
}

export const MONEY_REPOSITORY = Symbol('MONEY_REPOSITORY');

export class InMemoryMoneyRepository implements MoneyRepository {
  private readonly accounts = new Map<string, Account>();
  private readonly transactions = new Map<string, LedgerTransaction>();
  private readonly transactionsByIdempotency = new Map<string, string>();
  private readonly postings = new Map<string, LedgerPosting[]>();
  private readonly holdsByGig = new Map<string, EscrowHold>();

  async findAccount(
    ownerType: Account['ownerType'],
    ownerId: string,
    type: Account['type'],
  ): Promise<Account | null> {
    const account = [...this.accounts.values()].find(
      (item) => item.ownerType === ownerType && item.ownerId === ownerId && item.type === type,
    );
    return account ? { ...account } : null;
  }

  async findAccountById(id: string): Promise<Account | null> {
    const account = this.accounts.get(id);
    return account ? { ...account } : null;
  }

  async saveAccount(account: Account): Promise<void> {
    this.accounts.set(account.id, { ...account });
  }

  async findTransactionByIdempotencyKey(idempotencyKey: string): Promise<LedgerTransaction | null> {
    const id = this.transactionsByIdempotency.get(idempotencyKey);
    if (!id) return null;
    const transaction = this.transactions.get(id);
    return transaction ? { ...transaction } : null;
  }

  async listTransactionsByGig(gigId: string): Promise<LedgerTransaction[]> {
    return [...this.transactions.values()]
      .filter((transaction) => transaction.gigId === gigId)
      .map((transaction) => ({ ...transaction }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async saveTransaction(transaction: LedgerTransaction, postings: LedgerPosting[]): Promise<void> {
    assertBalanced(postings);
    this.transactions.set(transaction.id, { ...transaction });
    this.transactionsByIdempotency.set(transaction.idempotencyKey, transaction.id);
    this.postings.set(transaction.id, postings.map((posting) => ({ ...posting })));
  }

  async listPostings(transactionId: string): Promise<LedgerPosting[]> {
    return (this.postings.get(transactionId) ?? []).map((posting) => ({ ...posting }));
  }

  async findEscrowHoldByGig(gigId: string): Promise<EscrowHold | null> {
    const hold = this.holdsByGig.get(gigId);
    return hold ? { ...hold } : null;
  }

  async saveEscrowHold(hold: EscrowHold): Promise<void> {
    this.holdsByGig.set(hold.gigId, { ...hold });
  }
}

export function assertBalanced(postings: LedgerPosting[]): void {
  const debit = postings
    .filter((posting) => posting.direction === 'debit')
    .reduce((sum, posting) => sum + posting.amount, 0);
  const credit = postings
    .filter((posting) => posting.direction === 'credit')
    .reduce((sum, posting) => sum + posting.amount, 0);
  if (debit !== credit) {
    throw new Error(`Unbalanced ledger transaction: debit ${debit}, credit ${credit}`);
  }
}
