export type AccountType =
  | 'escrow_cash'
  | 'escrow_payable'
  | 'worker_payable'
  | 'platform_revenue';

export type LedgerDirection = 'debit' | 'credit';
export type EscrowHoldStatus = 'held' | 'released' | 'refunded' | 'disputed';

export interface Account {
  id: string;
  ownerType: 'system' | 'gig' | 'worker' | 'platform';
  ownerId: string;
  type: AccountType;
  currency: 'INR';
}

export interface LedgerTransaction {
  id: string;
  type: 'escrow_hold' | 'escrow_release' | 'escrow_refund' | 'escrow_dispute_opened';
  gigId?: string;
  idempotencyKey: string;
  status: 'posted';
  createdAt: string;
}

export interface LedgerPosting {
  id: string;
  transactionId: string;
  accountId: string;
  direction: LedgerDirection;
  amount: number;
  currency: 'INR';
}

export interface EscrowHold {
  id: string;
  gigId: string;
  amount: number;
  status: EscrowHoldStatus;
  providerRef?: string;
  createdAt: string;
}
