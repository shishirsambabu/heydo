import { Injectable } from '@nestjs/common';
import { PgService } from '../common/database/pg.service';
import {
  Account,
  EscrowHold,
  LedgerPosting,
  LedgerTransaction,
} from './money.entities';
import { assertBalanced, MoneyRepository } from './money.repository';

interface AccountRow {
  id: string;
  ownerType: Account['ownerType'];
  ownerId: string;
  type: Account['type'];
  currency: 'INR';
}

interface LedgerTransactionRow {
  id: string;
  type: LedgerTransaction['type'];
  gigId: string | null;
  idempotencyKey: string;
  status: LedgerTransaction['status'];
  createdAt: Date;
}

interface LedgerPostingRow {
  id: string;
  transactionId: string;
  accountId: string;
  direction: LedgerPosting['direction'];
  amount: number;
  currency: 'INR';
}

interface EscrowHoldRow {
  id: string;
  gigId: string;
  amount: number;
  status: EscrowHold['status'];
  providerRef: string | null;
  createdAt: Date;
}

@Injectable()
export class PostgresMoneyRepository implements MoneyRepository {
  constructor(private readonly pg: PgService) {}

  async findAccount(
    ownerType: Account['ownerType'],
    ownerId: string,
    type: Account['type'],
  ): Promise<Account | null> {
    const [row] = await this.pg.query<AccountRow>(
      `SELECT id, "ownerType", "ownerId", type, currency
       FROM "Account"
       WHERE "ownerType" = $1 AND "ownerId" = $2 AND type = $3
       LIMIT 1`,
      [ownerType, ownerId, type],
    );
    return row ? toAccount(row) : null;
  }

  async saveAccount(account: Account): Promise<void> {
    await this.pg.query(
      `INSERT INTO "Account" (id, "ownerType", "ownerId", type, currency)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ("ownerType", "ownerId", type, currency) DO NOTHING`,
      [account.id, account.ownerType, account.ownerId, account.type, account.currency],
    );
  }

  async findTransactionByIdempotencyKey(idempotencyKey: string): Promise<LedgerTransaction | null> {
    const [row] = await this.pg.query<LedgerTransactionRow>(
      `SELECT id, type, "gigId", "idempotencyKey", status, "createdAt"
       FROM "LedgerTransaction"
       WHERE "idempotencyKey" = $1`,
      [idempotencyKey],
    );
    return row ? toTransaction(row) : null;
  }

  async saveTransaction(transaction: LedgerTransaction, postings: LedgerPosting[]): Promise<void> {
    assertBalanced(postings);
    await this.pg.query(
      `INSERT INTO "LedgerTransaction" (id, type, "gigId", "idempotencyKey", status, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT ("idempotencyKey") DO NOTHING`,
      [
        transaction.id,
        transaction.type,
        transaction.gigId ?? null,
        transaction.idempotencyKey,
        transaction.status,
        transaction.createdAt,
      ],
    );
    for (const posting of postings) {
      await this.pg.query(
        `INSERT INTO "LedgerPosting"
          (id, "transactionId", "accountId", direction, amount, currency)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [
          posting.id,
          posting.transactionId,
          posting.accountId,
          posting.direction,
          posting.amount,
          posting.currency,
        ],
      );
    }
  }

  async listPostings(transactionId: string): Promise<LedgerPosting[]> {
    const rows = await this.pg.query<LedgerPostingRow>(
      `SELECT id, "transactionId", "accountId", direction, amount, currency
       FROM "LedgerPosting"
       WHERE "transactionId" = $1
       ORDER BY id ASC`,
      [transactionId],
    );
    return rows.map(toPosting);
  }

  async findEscrowHoldByGig(gigId: string): Promise<EscrowHold | null> {
    const [row] = await this.pg.query<EscrowHoldRow>(
      `SELECT id, "gigId", amount, status, "providerRef", "createdAt"
       FROM "EscrowHold"
       WHERE "gigId" = $1`,
      [gigId],
    );
    return row ? toEscrowHold(row) : null;
  }

  async saveEscrowHold(hold: EscrowHold): Promise<void> {
    await this.pg.query(
      `INSERT INTO "EscrowHold" (id, "gigId", amount, status, "providerRef", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT ("gigId") DO UPDATE SET
         amount = EXCLUDED.amount,
         status = EXCLUDED.status,
         "providerRef" = EXCLUDED."providerRef"`,
      [
        hold.id,
        hold.gigId,
        hold.amount,
        hold.status,
        hold.providerRef ?? null,
        hold.createdAt,
      ],
    );
  }
}

function toAccount(row: AccountRow): Account {
  return {
    id: row.id,
    ownerType: row.ownerType,
    ownerId: row.ownerId,
    type: row.type,
    currency: row.currency,
  };
}

function toTransaction(row: LedgerTransactionRow): LedgerTransaction {
  return {
    id: row.id,
    type: row.type,
    gigId: row.gigId ?? undefined,
    idempotencyKey: row.idempotencyKey,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

function toPosting(row: LedgerPostingRow): LedgerPosting {
  return {
    id: row.id,
    transactionId: row.transactionId,
    accountId: row.accountId,
    direction: row.direction,
    amount: row.amount,
    currency: row.currency,
  };
}

function toEscrowHold(row: EscrowHoldRow): EscrowHold {
  return {
    id: row.id,
    gigId: row.gigId,
    amount: row.amount,
    status: row.status,
    providerRef: row.providerRef ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}
