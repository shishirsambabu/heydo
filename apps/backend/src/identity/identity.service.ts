import { randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import {
  GiverProfile,
  GiverVerificationStatus,
  User,
  UserRole,
  WorkerProfile,
} from './entities';
import {
  GiverProfileRepository,
  UserRepository,
  WorkerProfileRepository,
} from './identity.repository';

@Injectable()
export class IdentityService {
  constructor(
    private readonly users: UserRepository,
    private readonly workers: WorkerProfileRepository,
    private readonly givers: GiverProfileRepository,
  ) {}

  /** Find or create a user by phone (called after OTP success). */
  async findOrCreateUser(phone: string, locale = 'ml'): Promise<User> {
    const existing = await this.users.findByPhone(phone);
    if (existing) return existing;
    const user: User = {
      id: `usr_${randomBytes(10).toString('hex')}`,
      phone,
      roles: [],
      locale,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    await this.users.save(user);
    return user;
  }

  async getUser(userId: string): Promise<User | null> {
    return this.users.findById(userId);
  }

  /** Add a role and create the matching profile shell. */
  async selectRole(userId: string, role: UserRole, displayName: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) throw new Error('User not found');
    if (!user.roles.includes(role)) user.roles.push(role);
    await this.users.save(user);

    if (role === 'worker' && !(await this.workers.findByUser(userId))) {
      const profile: WorkerProfile = {
        userId,
        displayName,
        skills: [],
        categoryIds: [],
        verificationStatus: 'unverified',
        heydoScore: null,
        createdAt: new Date().toISOString(),
      };
      await this.workers.save(profile);
    }
    if (role === 'giver' && !(await this.givers.findByUser(userId))) {
      const profile: GiverProfile = {
        userId,
        displayName,
        status: 'active',
        verificationStatus: 'unverified',
        createdAt: new Date().toISOString(),
      };
      await this.givers.save(profile);
    }
    return user;
  }

  async updateWorkerProfile(
    userId: string,
    patch: Partial<Pick<WorkerProfile, 'bioMl' | 'bioEn' | 'photoUrl' | 'skills' | 'categoryIds' | 'serviceAreaLabel'>>,
  ): Promise<WorkerProfile> {
    const p = await this.workers.findByUser(userId);
    if (!p) throw new Error('Worker profile not found');
    Object.assign(p, patch);
    await this.workers.save(p);
    return p;
  }

  async getWorkerProfile(userId: string): Promise<WorkerProfile | null> {
    return this.workers.findByUser(userId);
  }

  async getGiverProfile(userId: string): Promise<GiverProfile | null> {
    return this.givers.findByUser(userId);
  }

  async submitGiverVerification(
    userId: string,
    patch: {
      defaultLocationLabel?: string;
      locationEvidenceLabel: string;
      addressEvidenceVaultRef: string;
      selfieLivenessSessionId: string;
    },
  ): Promise<GiverProfile> {
    const p = await this.givers.findByUser(userId);
    if (!p) throw new Error('Giver profile not found');
    const updated: GiverProfile = {
      ...p,
      defaultLocationLabel: patch.defaultLocationLabel ?? p.defaultLocationLabel,
      locationEvidenceLabel: patch.locationEvidenceLabel.trim(),
      addressEvidenceVaultRef: patch.addressEvidenceVaultRef.trim(),
      selfieLivenessSessionId: patch.selfieLivenessSessionId.trim(),
      verificationStatus: 'pending_review',
      verificationNotes: undefined,
      verifiedBy: undefined,
      verifiedAt: undefined,
      reverificationReason: undefined,
    };
    await this.givers.save(updated);
    return updated;
  }

  listGiverVerifications(status?: GiverVerificationStatus): Promise<GiverProfile[]> {
    return this.givers.listForAdmin(status);
  }

  async reviewGiverVerification(
    userId: string,
    reviewerId: string,
    decision: 'approve' | 'reject' | 'require_reverification',
    notes: string,
  ): Promise<GiverProfile> {
    const p = await this.givers.findByUser(userId);
    if (!p) throw new Error('Giver profile not found');
    const verificationStatus: GiverVerificationStatus =
      decision === 'approve'
        ? 'approved'
        : decision === 'reject'
          ? 'rejected'
          : 'reverification_required';
    const updated: GiverProfile = {
      ...p,
      verificationStatus,
      verificationNotes: notes.trim(),
      verifiedBy: reviewerId,
      verifiedAt: new Date().toISOString(),
      reverificationReason: decision === 'require_reverification' ? notes.trim() : undefined,
    };
    await this.givers.save(updated);
    return updated;
  }
}
