import { Injectable } from '@nestjs/common';
import {
  GiverProfile,
  GiverVerificationStatus,
  User,
  UserRole,
  VerificationStatus,
  WorkerProfile,
} from './entities';
import type {
  IdentityVerificationSink,
  VerificationSubjectRole,
} from '../verification/verification.service';

/**
 * In-memory identity stores for Phase 1. Same interfaces will back onto
 * PostgreSQL in deployment. WorkerProfileRepository implements
 * WorkerVerificationSink so the verification service can keep a worker's
 * verificationStatus current.
 */
@Injectable()
export class UserRepository {
  private readonly byId = new Map<string, User>();
  private readonly byPhone = new Map<string, string>();

  async findByPhone(phone: string): Promise<User | null> {
    const id = this.byPhone.get(phone);
    return id ? { ...this.byId.get(id)! } : null;
  }
  async findById(id: string): Promise<User | null> {
    const u = this.byId.get(id);
    return u ? { ...u } : null;
  }
  async save(user: User): Promise<void> {
    this.byId.set(user.id, { ...user });
    this.byPhone.set(user.phone, user.id);
  }
}

@Injectable()
export class WorkerProfileRepository {
  private readonly byUser = new Map<string, WorkerProfile>();

  async save(p: WorkerProfile): Promise<void> {
    this.byUser.set(p.userId, { ...p });
  }
  async findByUser(userId: string): Promise<WorkerProfile | null> {
    const p = this.byUser.get(userId);
    return p ? { ...p } : null;
  }

  async setStatus(userId: string, status: VerificationStatus): Promise<void> {
    const p = this.byUser.get(userId);
    if (p) {
      p.verificationStatus = status;
      this.byUser.set(userId, p);
    }
  }
}

@Injectable()
export class GiverProfileRepository {
  private readonly byUser = new Map<string, GiverProfile>();

  async save(p: GiverProfile): Promise<void> {
    this.byUser.set(p.userId, { ...p });
  }
  async findByUser(userId: string): Promise<GiverProfile | null> {
    const p = this.byUser.get(userId);
    return p ? { ...p } : null;
  }

  async listForAdmin(status?: GiverVerificationStatus): Promise<GiverProfile[]> {
    return [...this.byUser.values()]
      .filter((p) => !status || p.verificationStatus === status)
      .map((p) => ({ ...p }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async setVerificationStatus(userId: string, status: GiverVerificationStatus): Promise<void> {
    const p = this.byUser.get(userId);
    if (p) {
      p.verificationStatus = status;
      p.verifiedAt = status === 'approved' ? new Date().toISOString() : p.verifiedAt;
      this.byUser.set(userId, p);
    }
  }
}

@Injectable()
export class IdentityVerificationStatusSink implements IdentityVerificationSink {
  constructor(
    private readonly workers: WorkerProfileRepository,
    private readonly givers: GiverProfileRepository,
  ) {}

  async setStatus(
    userId: string,
    subjectRole: VerificationSubjectRole,
    status: VerificationStatus,
  ): Promise<void> {
    if (subjectRole === 'worker') {
      await this.workers.setStatus(userId, status);
      return;
    }
    await this.givers.setVerificationStatus(userId, toGiverVerificationStatus(status));
  }
}

function toGiverVerificationStatus(status: VerificationStatus): GiverVerificationStatus {
  if (status === 'pending') return 'pending_review';
  if (status === 'approved') return 'approved';
  if (status === 'rejected') return 'rejected';
  if (status === 'expired') return 'reverification_required';
  return 'unverified';
}

export type { UserRole };
