import { Injectable } from '@nestjs/common';
import { PgService } from '../common/database/pg.service';
import { Consent, ConsentPurpose, Verification } from './verification.entities';
import { ConsentRepository, VerificationRepository } from './verification.repository';
import { VerificationStatus } from '../identity/entities';

interface VerificationRow {
  id: string;
  userId: string;
  subjectRole: Verification['subjectRole'];
  vendor: string;
  sessionId: string;
  status: VerificationStatus;
  livenessPassed: boolean | null;
  aadhaarMatch: boolean | null;
  faceMatchScore: number | null;
  vendorResultAt: Date | null;
  aadhaarVaultRef: string | null;
  mediaVaultRef: string | null;
  reviewedBy: string | null;
  decisionReason: string | null;
  decisionAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}

interface ConsentRow {
  id: string;
  userId: string;
  purpose: ConsentPurpose;
  policyVersion: string;
  grantedAt: Date;
  revokedAt: Date | null;
}

@Injectable()
export class PostgresVerificationRepository implements VerificationRepository {
  constructor(private readonly pg: PgService) {}

  async save(v: Verification): Promise<void> {
    await this.pg.query(
      `INSERT INTO "Verification"
        (id, "userId", "subjectRole", vendor, "sessionId", status, "livenessPassed", "aadhaarMatch",
         "faceMatchScore", "vendorResultAt", "aadhaarVaultRef", "mediaVaultRef",
         "reviewedBy", "decisionReason", "decisionAt", "expiresAt", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       ON CONFLICT (id) DO UPDATE SET
         "subjectRole" = EXCLUDED."subjectRole",
         status = EXCLUDED.status,
         "livenessPassed" = EXCLUDED."livenessPassed",
         "aadhaarMatch" = EXCLUDED."aadhaarMatch",
         "faceMatchScore" = EXCLUDED."faceMatchScore",
         "vendorResultAt" = EXCLUDED."vendorResultAt",
         "aadhaarVaultRef" = EXCLUDED."aadhaarVaultRef",
         "mediaVaultRef" = EXCLUDED."mediaVaultRef",
         "reviewedBy" = EXCLUDED."reviewedBy",
         "decisionReason" = EXCLUDED."decisionReason",
         "decisionAt" = EXCLUDED."decisionAt",
         "expiresAt" = EXCLUDED."expiresAt"`,
      [
        v.id,
        v.userId,
        v.subjectRole,
        v.vendor,
        v.sessionId,
        v.status,
        v.livenessPassed ?? null,
        v.aadhaarMatch ?? null,
        v.faceMatchScore ?? null,
        v.vendorResultAt ?? null,
        v.aadhaarVaultRef ?? null,
        v.mediaVaultRef ?? null,
        v.reviewedBy ?? null,
        v.decisionReason ?? null,
        v.decisionAt ?? null,
        v.expiresAt ?? null,
        v.createdAt,
      ],
    );
  }

  async findById(id: string): Promise<Verification | null> {
    const [row] = await this.pg.query<VerificationRow>(
      `${selectVerification()} WHERE id = $1`,
      [id],
    );
    return row ? toVerification(row) : null;
  }

  async findBySession(sessionId: string): Promise<Verification | null> {
    const [row] = await this.pg.query<VerificationRow>(
      `${selectVerification()} WHERE "sessionId" = $1`,
      [sessionId],
    );
    return row ? toVerification(row) : null;
  }

  async findLatestForUser(
    userId: string,
    subjectRole?: Verification['subjectRole'],
  ): Promise<Verification | null> {
    const [row] = await this.pg.query<VerificationRow>(
      `${selectVerification()}
       WHERE "userId" = $1 AND ($2::text IS NULL OR "subjectRole" = $2)
       ORDER BY "createdAt" DESC LIMIT 1`,
      [userId, subjectRole ?? null],
    );
    return row ? toVerification(row) : null;
  }

  async listPendingReview(): Promise<Verification[]> {
    const rows = await this.pg.query<VerificationRow>(
      `${selectVerification()}
       WHERE "subjectRole" = 'worker' AND status = 'pending' AND "vendorResultAt" IS NOT NULL
       ORDER BY "vendorResultAt" ASC`,
    );
    return rows.map(toVerification);
  }
}

@Injectable()
export class PostgresConsentRepository implements ConsentRepository {
  constructor(private readonly pg: PgService) {}

  async save(c: Consent): Promise<void> {
    await this.pg.query(
      `INSERT INTO "Consent" (id, "userId", purpose, "policyVersion", "grantedAt", "revokedAt")
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         "revokedAt" = EXCLUDED."revokedAt"`,
      [c.id, c.userId, c.purpose, c.policyVersion, c.grantedAt, c.revokedAt ?? null],
    );
  }

  async find(userId: string, purpose: string): Promise<Consent | null> {
    const [row] = await this.pg.query<ConsentRow>(
      `SELECT id, "userId", purpose, "policyVersion", "grantedAt", "revokedAt"
       FROM "Consent"
       WHERE "userId" = $1 AND purpose = $2 AND "revokedAt" IS NULL
       ORDER BY "grantedAt" DESC
       LIMIT 1`,
      [userId, purpose],
    );
    return row ? toConsent(row) : null;
  }
}

function selectVerification(): string {
  return `SELECT id, "userId", "subjectRole", vendor, "sessionId", status, "livenessPassed",
                 "aadhaarMatch", "faceMatchScore", "vendorResultAt", "aadhaarVaultRef",
                 "mediaVaultRef", "reviewedBy", "decisionReason", "decisionAt",
                 "expiresAt", "createdAt"
          FROM "Verification"`;
}

function toVerification(row: VerificationRow): Verification {
  return {
    id: row.id,
    userId: row.userId,
    subjectRole: row.subjectRole,
    vendor: row.vendor,
    sessionId: row.sessionId,
    status: row.status,
    livenessPassed: row.livenessPassed ?? undefined,
    aadhaarMatch: row.aadhaarMatch ?? undefined,
    faceMatchScore: row.faceMatchScore ?? undefined,
    vendorResultAt: row.vendorResultAt?.toISOString(),
    aadhaarVaultRef: row.aadhaarVaultRef ?? undefined,
    mediaVaultRef: row.mediaVaultRef ?? undefined,
    reviewedBy: row.reviewedBy ?? undefined,
    decisionReason: row.decisionReason ?? undefined,
    decisionAt: row.decisionAt?.toISOString(),
    expiresAt: row.expiresAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

function toConsent(row: ConsentRow): Consent {
  return {
    id: row.id,
    userId: row.userId,
    purpose: row.purpose,
    policyVersion: row.policyVersion,
    grantedAt: row.grantedAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString(),
  };
}
