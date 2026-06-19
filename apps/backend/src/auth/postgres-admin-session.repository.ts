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
  createdAt: Date;
}

@Injectable()
export class PostgresAdminSessionRepository implements AdminSessionRepository {
  constructor(private readonly pg: PgService) {}

  async save(session: AdminSession): Promise<void> {
    await this.pg.query(
      `INSERT INTO "AdminSession"
        (id, "adminId", "deviceId", "mfaVerifiedAt", "expiresAt", "revokedAt", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         "deviceId" = EXCLUDED."deviceId",
         "mfaVerifiedAt" = EXCLUDED."mfaVerifiedAt",
         "expiresAt" = EXCLUDED."expiresAt",
         "revokedAt" = EXCLUDED."revokedAt"`,
      [
        session.id,
        session.adminId,
        session.deviceId,
        session.mfaVerifiedAt,
        session.expiresAt,
        session.revokedAt ?? null,
        session.createdAt,
      ],
    );
  }

  async findById(id: string): Promise<AdminSession | null> {
    const [row] = await this.pg.query<AdminSessionRow>(
      `SELECT id, "adminId", "deviceId", "mfaVerifiedAt", "expiresAt", "revokedAt", "createdAt"
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
}

function toAdminSession(row: AdminSessionRow): AdminSession {
  return {
    id: row.id,
    adminId: row.adminId,
    deviceId: row.deviceId,
    mfaVerifiedAt: row.mfaVerifiedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}
