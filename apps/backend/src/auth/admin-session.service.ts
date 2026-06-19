import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuthPrincipal } from './auth.types';
import {
  ADMIN_SESSION_REPOSITORY,
  AdminSession,
  AdminSessionRepository,
} from './admin-session.repository';

export type AdminSessionStatus = 'active' | 'step_up_required' | 'revoked' | 'expired';

export interface AdminSessionListItem {
  id: string;
  adminId: string;
  deviceId: string;
  status: AdminSessionStatus;
  mfaVerifiedAt: string;
  expiresAt: string;
  revokedAt?: string;
  stepUpRequiredAt?: string;
  stepUpReason?: string;
  createdAt: string;
}

export interface AdminSessionList {
  sessions: AdminSessionListItem[];
  summary: Record<AdminSessionStatus, number>;
}

export class AdminSessionError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'admin_fresh_verification_required'
      | 'admin_session_untrusted'
      | 'admin_session_revoked'
      | 'admin_session_expired'
      | 'admin_session_not_found'
      | 'admin_step_up_required',
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

  async revoke(sessionId: string): Promise<AdminSession> {
    const session = await this.sessions.findById(sessionId);
    if (!session) {
      throw new AdminSessionError('Admin session was not found', 'admin_session_not_found');
    }
    const revokedAt = new Date().toISOString();
    await this.sessions.revoke(sessionId, revokedAt);
    return { ...session, revokedAt };
  }

  async listSessions(limit = 100): Promise<AdminSessionList> {
    const boundedLimit = Math.min(Math.max(limit, 1), 200);
    const sessions = (await this.sessions.list(boundedLimit)).map(toListItem);
    return {
      sessions,
      summary: sessions.reduce<Record<AdminSessionStatus, number>>(
        (summary, session) => ({
          ...summary,
          [session.status]: summary[session.status] + 1,
        }),
        { active: 0, step_up_required: 0, revoked: 0, expired: 0 },
      ),
    };
  }

  async requireStepUp(sessionId: string, reason: string): Promise<AdminSession> {
    const session = await this.sessions.findById(sessionId);
    if (!session) {
      throw new AdminSessionError('Admin session was not found', 'admin_session_not_found');
    }
    const stepUpRequiredAt = new Date().toISOString();
    const stepUpReason = reason.trim();
    await this.sessions.requireStepUp(sessionId, stepUpRequiredAt, stepUpReason);
    return { ...session, stepUpRequiredAt, stepUpReason };
  }

  async completeStepUp(principal: AuthPrincipal): Promise<AdminSession> {
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

    const mfaVerifiedAt = new Date().toISOString();
    await this.sessions.completeStepUp(session.id, mfaVerifiedAt);
    return {
      ...session,
      mfaVerifiedAt,
      stepUpRequiredAt: undefined,
      stepUpReason: undefined,
    };
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
    if (session.stepUpRequiredAt) {
      throw new AdminSessionError('Admin session requires step-up verification', 'admin_step_up_required');
    }
    if (now - Date.parse(session.mfaVerifiedAt) > freshnessMs) {
      throw new AdminSessionError(
        'Fresh admin verification required for sensitive action',
        'admin_fresh_verification_required',
      );
    }
  }
}

function toListItem(session: AdminSession): AdminSessionListItem {
  return {
    id: session.id,
    adminId: session.adminId,
    deviceId: session.deviceId,
    status: sessionStatus(session),
    mfaVerifiedAt: session.mfaVerifiedAt,
    expiresAt: session.expiresAt,
    revokedAt: session.revokedAt,
    stepUpRequiredAt: session.stepUpRequiredAt,
    stepUpReason: session.stepUpReason,
    createdAt: session.createdAt,
  };
}

function sessionStatus(session: AdminSession): AdminSessionStatus {
  if (session.revokedAt) return 'revoked';
  if (Date.parse(session.expiresAt) <= Date.now()) return 'expired';
  if (session.stepUpRequiredAt) return 'step_up_required';
  return 'active';
}
