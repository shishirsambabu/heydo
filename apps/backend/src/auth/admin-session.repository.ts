export interface AdminSession {
  id: string;
  adminId: string;
  deviceId: string;
  mfaVerifiedAt: string;
  expiresAt: string;
  revokedAt?: string;
  stepUpRequiredAt?: string;
  stepUpReason?: string;
  createdAt: string;
}

export const ADMIN_SESSION_REPOSITORY = Symbol('ADMIN_SESSION_REPOSITORY');

export interface AdminSessionRepository {
  save(session: AdminSession): Promise<void>;
  findById(id: string): Promise<AdminSession | null>;
  revoke(id: string, revokedAt: string): Promise<void>;
  requireStepUp(id: string, requiredAt: string, reason: string): Promise<void>;
  completeStepUp(id: string, verifiedAt: string): Promise<void>;
}

export class InMemoryAdminSessionRepository implements AdminSessionRepository {
  private readonly sessions = new Map<string, AdminSession>();

  async save(session: AdminSession): Promise<void> {
    this.sessions.set(session.id, { ...session });
  }

  async findById(id: string): Promise<AdminSession | null> {
    const session = this.sessions.get(id);
    return session ? { ...session } : null;
  }

  async revoke(id: string, revokedAt: string): Promise<void> {
    const session = this.sessions.get(id);
    if (!session) return;
    this.sessions.set(id, { ...session, revokedAt });
  }

  async requireStepUp(id: string, requiredAt: string, reason: string): Promise<void> {
    const session = this.sessions.get(id);
    if (!session) return;
    this.sessions.set(id, { ...session, stepUpRequiredAt: requiredAt, stepUpReason: reason });
  }

  async completeStepUp(id: string, verifiedAt: string): Promise<void> {
    const session = this.sessions.get(id);
    if (!session) return;
    this.sessions.set(id, {
      ...session,
      mfaVerifiedAt: verifiedAt,
      stepUpRequiredAt: undefined,
      stepUpReason: undefined,
    });
  }
}
