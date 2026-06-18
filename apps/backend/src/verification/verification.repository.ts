import { Verification, Consent } from './verification.entities';

/**
 * Persistence ports for verification. Phase 1 ships in-memory implementations;
 * production swaps in PostgreSQL-backed repositories with the same interfaces.
 */
export interface VerificationRepository {
  save(v: Verification): Promise<void>;
  findById(id: string): Promise<Verification | null>;
  findBySession(sessionId: string): Promise<Verification | null>;
  /** Latest verification for a user, by createdAt. */
  findLatestForUser(userId: string, subjectRole?: Verification['subjectRole']): Promise<Verification | null>;
  /** Verifications awaiting officer review (vendor result in, status pending). */
  listPendingReview(): Promise<Verification[]>;
}

export interface ConsentRepository {
  save(c: Consent): Promise<void>;
  find(userId: string, purpose: string): Promise<Consent | null>;
}

export const VERIFICATION_REPOSITORY = Symbol('VERIFICATION_REPOSITORY');
export const CONSENT_REPOSITORY = Symbol('CONSENT_REPOSITORY');

export class InMemoryVerificationRepository implements VerificationRepository {
  private readonly items = new Map<string, Verification>();

  async save(v: Verification): Promise<void> {
    this.items.set(v.id, { ...v });
  }
  async findById(id: string): Promise<Verification | null> {
    const v = this.items.get(id);
    return v ? { ...v } : null;
  }
  async findBySession(sessionId: string): Promise<Verification | null> {
    for (const v of this.items.values()) {
      if (v.sessionId === sessionId) return { ...v };
    }
    return null;
  }
  async findLatestForUser(
    userId: string,
    subjectRole?: Verification['subjectRole'],
  ): Promise<Verification | null> {
    const mine = [...this.items.values()]
      .filter((v) => v.userId === userId && (!subjectRole || v.subjectRole === subjectRole))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return mine.length ? { ...mine[0] } : null;
  }
  async listPendingReview(): Promise<Verification[]> {
    return [...this.items.values()]
      .filter((v) => v.subjectRole === 'worker' && v.status === 'pending' && v.vendorResultAt != null)
      .map((v) => ({ ...v }))
      .sort((a, b) => (a.vendorResultAt ?? '').localeCompare(b.vendorResultAt ?? ''));
  }
}

export class InMemoryConsentRepository implements ConsentRepository {
  private readonly items: Consent[] = [];

  async save(c: Consent): Promise<void> {
    this.items.push({ ...c });
  }
  async find(userId: string, purpose: string): Promise<Consent | null> {
    const found = this.items
      .filter((c) => c.userId === userId && c.purpose === purpose && !c.revokedAt)
      .pop();
    return found ? { ...found } : null;
  }
}
