import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuthPrincipal } from './auth.types';
import {
  ADMIN_SESSION_REPOSITORY,
  AdminSession,
  AdminSessionRepository,
} from './admin-session.repository';

export class AdminSessionError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'admin_fresh_verification_required'
      | 'admin_session_untrusted'
      | 'admin_session_revoked'
      | 'admin_session_expired',
  ) {
    super(message);
  }
}

@Injectable()
export class AdminSessionService {
  constructor(
    @Inject(ADMIN_SESSION_REPOSITORY)
    private readonly sessions: AdminSessionRepository,
  ) {}

  async createSession(
    adminId: string,
    deviceId: string,
    ttlMs = 7 * 24 * 60 * 60_000,
  ): Promise<AdminSession> {
    const now = new Date();
    const session: AdminSession = {
      id: `adm_sess_${randomUUID()}`,
      adminId,
      deviceId,
      mfaVerifiedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      createdAt: now.toISOString(),
    };
    await this.sessions.save(session);
    return session;
  }

  async revoke(sessionId: string): Promise<void> {
    await this.sessions.revoke(sessionId, new Date().toISOString());
  }

  async assertFresh(principal: AuthPrincipal, freshnessMs = 15 * 60_000): Promise<void> {
    if (
      principal.kind !== 'admin' ||
      !principal.adminSessionId ||
      !principal.adminDeviceId?.trim()
    ) {
      throw new AdminSessionError(
        'Fresh admin verification required for sensitive action',
        'admin_fresh_verification_required',
      );
    }

    const session = await this.sessions.findById(principal.adminSessionId);
    if (
      !session ||
      session.adminId !== principal.sub ||
      session.deviceId !== principal.adminDeviceId
    ) {
      throw new AdminSessionError(
        'Admin session is not trusted for this device',
        'admin_session_untrusted',
      );
    }
    if (session.revokedAt) {
      throw new AdminSessionError('Admin session has been revoked', 'admin_session_revoked');
    }

    const now = Date.now();
    if (Date.parse(session.expiresAt) <= now) {
      throw new AdminSessionError('Admin session has expired', 'admin_session_expired');
    }
    if (now - Date.parse(session.mfaVerifiedAt) > freshnessMs) {
      throw new AdminSessionError(
        'Fresh admin verification required for sensitive action',
        'admin_fresh_verification_required',
      );
    }
  }
}
