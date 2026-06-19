import { Injectable } from '@nestjs/common';
import { PgService } from '../common/database/pg.service';
import { AdminSession, AdminSessionRepository } from './admin-session.repository';

interface AdminSessionRow {
  id: string;
  adminId: string;
  deviceId: string;
  mfaVerifiedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  stepUpRequiredAt: Date | null;
  stepUpReason: string | null;
  createdAt: Date;
}

@Injectable()
export class PostgresAdminSessionRepository implements AdminSessionRepository {
  constructor(private readonly pg: PgService) {}

  async save(session: AdminSession): Promise<void> {
    await this.pg.query(
      `INSERT INTO "AdminSession"
        (id, "adminId", "deviceId", "mfaVerifiedAt", "expiresAt", "revokedAt",
         "stepUpRequiredAt", "stepUpReason", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         "deviceId" = EXCLUDED."deviceId",
         "mfaVerifiedAt" = EXCLUDED."mfaVerifiedAt",
         "expiresAt" = EXCLUDED."expiresAt",
         "revokedAt" = EXCLUDED."revokedAt",
         "stepUpRequiredAt" = EXCLUDED."stepUpRequiredAt",
         "stepUpReason" = EXCLUDED."stepUpReason"`,
      [
        session.id,
        session.adminId,
        session.deviceId,
        session.mfaVerifiedAt,
        session.expiresAt,
        session.revokedAt ?? null,
        session.stepUpRequiredAt ?? null,
        session.stepUpReason ?? null,
        session.createdAt,
      ],
    );
  }

  async findById(id: string): Promise<AdminSession | null> {
    const [row] = await this.pg.query<AdminSessionRow>(
      `SELECT id, "adminId", "deviceId", "mfaVerifiedAt", "expiresAt", "revokedAt",
              "stepUpRequiredAt", "stepUpReason", "createdAt"
       FROM "AdminSession"
       WHERE id = $1`,
      [id],
    );
    return row ? toAdminSession(row) : null;
  }

  async revoke(id: string, revokedAt: string): Promise<void> {
    await this.pg.query('UPDATE "AdminSession" SET "revokedAt" = $2 WHERE id = $1', [
      id,
      revokedAt,
    ]);
  }

  async requireStepUp(id: string, requiredAt: string, reason: string): Promise<void> {
    await this.pg.query(
      `UPDATE "AdminSession"
       SET "stepUpRequiredAt" = $2, "stepUpReason" = $3
       WHERE id = $1`,
      [id, requiredAt, reason],
    );
  }

  async completeStepUp(id: string, verifiedAt: string): Promise<void> {
    await this.pg.query(
      `UPDATE "AdminSession"
       SET "mfaVerifiedAt" = $2, "stepUpRequiredAt" = NULL, "stepUpReason" = NULL
       WHERE id = $1`,
      [id, verifiedAt],
    );
  }
}

function toAdminSession(row: AdminSessionRow): AdminSession {
  return {
    id: row.id,
    adminId: row.adminId,
    deviceId: row.deviceId,
    mfaVerifiedAt: row.mfaVerifiedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString(),
    stepUpRequiredAt: row.stepUpRequiredAt?.toISOString(),
    stepUpReason: row.stepUpReason ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}
