import { Injectable } from '@nestjs/common';
import { PgService } from '../common/database/pg.service';
import {
  GiverProfile,
  GiverVerificationStatus,
  User,
  UserRole,
  VerificationStatus,
  WorkerProfile,
} from './entities';
import { WorkerVerificationSink } from '../verification/verification.service';

interface UserRow {
  id: string;
  phone: string;
  roles: UserRole[];
  locale: string;
  status: string;
  createdAt: Date;
}

interface WorkerProfileRow {
  userId: string;
  displayName: string;
  bioMl: string | null;
  bioEn: string | null;
  photoUrl: string | null;
  skills: string[];
  categoryIds: string[];
  serviceAreaLabel: string | null;
  verificationStatus: VerificationStatus;
  heydoScore: number | null;
  createdAt: Date;
}

interface GiverProfileRow {
  userId: string;
  displayName: string;
  defaultLocation: string | null;
  status: string;
  verificationStatus: GiverVerificationStatus;
  locationEvidenceLabel: string | null;
  addressEvidenceVaultRef: string | null;
  selfieLivenessSessionId: string | null;
  verificationNotes: string | null;
  verifiedBy: string | null;
  verifiedAt: Date | null;
  reverificationReason: string | null;
  createdAt: Date;
}

@Injectable()
export class PostgresUserRepository {
  constructor(private readonly pg: PgService) {}

  async findByPhone(phone: string): Promise<User | null> {
    const [row] = await this.pg.query<UserRow>(
      'SELECT id, phone, roles, locale, status, "createdAt" FROM "User" WHERE phone = $1',
      [phone],
    );
    return row ? toUser(row) : null;
  }

  async findById(id: string): Promise<User | null> {
    const [row] = await this.pg.query<UserRow>(
      'SELECT id, phone, roles, locale, status, "createdAt" FROM "User" WHERE id = $1',
      [id],
    );
    return row ? toUser(row) : null;
  }

  async save(user: User): Promise<void> {
    await this.pg.query(
      `INSERT INTO "User" (id, phone, roles, locale, status, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         phone = EXCLUDED.phone,
         roles = EXCLUDED.roles,
         locale = EXCLUDED.locale,
         status = EXCLUDED.status`,
      [user.id, user.phone, user.roles, user.locale, user.status, user.createdAt],
    );
  }
}

@Injectable()
export class PostgresWorkerProfileRepository implements WorkerVerificationSink {
  constructor(private readonly pg: PgService) {}

  async save(p: WorkerProfile): Promise<void> {
    await this.pg.query(
      `INSERT INTO "WorkerProfile"
        ("userId", "displayName", "bioMl", "bioEn", "photoUrl", skills, "categoryIds",
         "serviceAreaLabel", "verificationStatus", "heydoScore", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT ("userId") DO UPDATE SET
         "displayName" = EXCLUDED."displayName",
         "bioMl" = EXCLUDED."bioMl",
         "bioEn" = EXCLUDED."bioEn",
         "photoUrl" = EXCLUDED."photoUrl",
         skills = EXCLUDED.skills,
         "categoryIds" = EXCLUDED."categoryIds",
         "serviceAreaLabel" = EXCLUDED."serviceAreaLabel",
         "verificationStatus" = EXCLUDED."verificationStatus",
         "heydoScore" = EXCLUDED."heydoScore"`,
      [
        p.userId,
        p.displayName,
        p.bioMl ?? null,
        p.bioEn ?? null,
        p.photoUrl ?? null,
        p.skills,
        p.categoryIds,
        p.serviceAreaLabel ?? null,
        p.verificationStatus,
        p.heydoScore,
        p.createdAt,
      ],
    );
  }

  async findByUser(userId: string): Promise<WorkerProfile | null> {
    const [row] = await this.pg.query<WorkerProfileRow>(
      `SELECT "userId", "displayName", "bioMl", "bioEn", "photoUrl", skills,
              "categoryIds", "serviceAreaLabel", "verificationStatus", "heydoScore", "createdAt"
       FROM "WorkerProfile" WHERE "userId" = $1`,
      [userId],
    );
    return row ? toWorker(row) : null;
  }

  async setStatus(userId: string, status: VerificationStatus): Promise<void> {
    await this.pg.query(
      'UPDATE "WorkerProfile" SET "verificationStatus" = $2 WHERE "userId" = $1',
      [userId, status],
    );
  }
}

@Injectable()
export class PostgresGiverProfileRepository {
  constructor(private readonly pg: PgService) {}

  async save(p: GiverProfile): Promise<void> {
    await this.pg.query(
      `INSERT INTO "GiverProfile"
        ("userId", "displayName", "defaultLocation", status, "verificationStatus",
         "locationEvidenceLabel", "addressEvidenceVaultRef", "selfieLivenessSessionId",
         "verificationNotes", "verifiedBy", "verifiedAt", "reverificationReason", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT ("userId") DO UPDATE SET
         "displayName" = EXCLUDED."displayName",
         "defaultLocation" = EXCLUDED."defaultLocation",
         status = EXCLUDED.status,
         "verificationStatus" = EXCLUDED."verificationStatus",
         "locationEvidenceLabel" = EXCLUDED."locationEvidenceLabel",
         "addressEvidenceVaultRef" = EXCLUDED."addressEvidenceVaultRef",
         "selfieLivenessSessionId" = EXCLUDED."selfieLivenessSessionId",
         "verificationNotes" = EXCLUDED."verificationNotes",
         "verifiedBy" = EXCLUDED."verifiedBy",
         "verifiedAt" = EXCLUDED."verifiedAt",
         "reverificationReason" = EXCLUDED."reverificationReason"`,
      [
        p.userId,
        p.displayName,
        p.defaultLocationLabel ?? null,
        p.status,
        p.verificationStatus,
        p.locationEvidenceLabel ?? null,
        p.addressEvidenceVaultRef ?? null,
        p.selfieLivenessSessionId ?? null,
        p.verificationNotes ?? null,
        p.verifiedBy ?? null,
        p.verifiedAt ?? null,
        p.reverificationReason ?? null,
        p.createdAt,
      ],
    );
  }

  async findByUser(userId: string): Promise<GiverProfile | null> {
    const [row] = await this.pg.query<GiverProfileRow>(
      `SELECT "userId", "displayName", "defaultLocation", status, "verificationStatus",
              "locationEvidenceLabel", "addressEvidenceVaultRef", "selfieLivenessSessionId",
              "verificationNotes", "verifiedBy", "verifiedAt", "reverificationReason", "createdAt"
       FROM "GiverProfile" WHERE "userId" = $1`,
      [userId],
    );
    return row ? toGiver(row) : null;
  }

  async listForAdmin(status?: GiverVerificationStatus): Promise<GiverProfile[]> {
    const rows = await this.pg.query<GiverProfileRow>(
      `SELECT "userId", "displayName", "defaultLocation", status, "verificationStatus",
              "locationEvidenceLabel", "addressEvidenceVaultRef", "selfieLivenessSessionId",
              "verificationNotes", "verifiedBy", "verifiedAt", "reverificationReason", "createdAt"
       FROM "GiverProfile"
       WHERE ($1::text IS NULL OR "verificationStatus" = $1)
       ORDER BY "createdAt" ASC`,
      [status ?? null],
    );
    return rows.map(toGiver);
  }
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    phone: row.phone,
    roles: row.roles,
    locale: row.locale,
    status: row.status as User['status'],
    createdAt: row.createdAt.toISOString(),
  };
}

function toWorker(row: WorkerProfileRow): WorkerProfile {
  return {
    userId: row.userId,
    displayName: row.displayName,
    bioMl: row.bioMl ?? undefined,
    bioEn: row.bioEn ?? undefined,
    photoUrl: row.photoUrl ?? undefined,
    skills: row.skills,
    categoryIds: row.categoryIds,
    serviceAreaLabel: row.serviceAreaLabel ?? undefined,
    verificationStatus: row.verificationStatus,
    heydoScore: row.heydoScore,
    createdAt: row.createdAt.toISOString(),
  };
}

function toGiver(row: GiverProfileRow): GiverProfile {
  return {
    userId: row.userId,
    displayName: row.displayName,
    defaultLocationLabel: row.defaultLocation ?? undefined,
    status: row.status as GiverProfile['status'],
    verificationStatus: row.verificationStatus,
    locationEvidenceLabel: row.locationEvidenceLabel ?? undefined,
    addressEvidenceVaultRef: row.addressEvidenceVaultRef ?? undefined,
    selfieLivenessSessionId: row.selfieLivenessSessionId ?? undefined,
    verificationNotes: row.verificationNotes ?? undefined,
    verifiedBy: row.verifiedBy ?? undefined,
    verifiedAt: row.verifiedAt?.toISOString(),
    reverificationReason: row.reverificationReason ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}
