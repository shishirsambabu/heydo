import { Injectable } from '@nestjs/common';
import { PgService } from '../common/database/pg.service';
import {
  Assignment,
  Category,
  DEFAULT_CATEGORIES,
  EscalationPackageManifest,
  EvidenceVaultRef,
  Gig,
  GigApplication,
  Rating,
  RatingDirection,
  SafetyReport,
} from './marketplace.entities';
import {
  ApplicationRepository,
  AssignmentRepository,
  CategoryRepository,
  EvidenceVaultRefRepository,
  EscalationPackageRepository,
  GigFilters,
  GigRepository,
  RatingRepository,
  SafetyReportRepository,
} from './marketplace.repository';

interface CategoryRow {
  id: string;
  nameMl: string;
  nameEn: string;
  group: Category['group'];
  active: boolean;
}

interface GigRow {
  id: string;
  giverId: string;
  categoryId: string;
  title: string;
  description: string;
  location: string;
  scheduledAt: Date;
  budgetAmount: number;
  currency: 'INR';
  status: Gig['status'];
  visibilityStatus: Gig['visibilityStatus'];
  riskLevel: Gig['riskLevel'];
  safetyFlags: string[];
  moderatedBy: string | null;
  moderatedAt: Date | null;
  moderationReason: string | null;
  createdAt: Date;
}

interface ApplicationRow {
  id: string;
  gigId: string;
  workerId: string;
  messageMl: string | null;
  proposedPrice: number | null;
  priceDeltaAmount: number;
  negotiationTokenCost: number;
  status: GigApplication['status'];
  createdAt: Date;
}

interface AssignmentRow {
  id: string;
  gigId: string;
  workerId: string;
  applicationId: string;
  agreedAmount: number;
  platformFeeAmount: number;
  workerPayoutAmount: number;
  selectedAt: Date;
}

interface RatingRow {
  id: string;
  gigId: string;
  raterId: string;
  rateeId: string;
  direction: RatingDirection;
  stars: number;
  tags: string[] | null;
  comment: string | null;
  createdAt: Date;
}

interface SafetyReportRow {
  id: string;
  gigId: string;
  reporterId: string;
  reportedUserId: string | null;
  reason: SafetyReport['reason'];
  severity: SafetyReport['severity'];
  description: string;
  evidenceVaultRefs: string[];
  status: SafetyReport['status'];
  actionTaken: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  lawEnforcementRef: string | null;
  createdAt: Date;
}

interface EscalationPackageManifestRow {
  id: string;
  reportId: string;
  gigId: string;
  generatedBy: string;
  generatedAt: Date;
  evidenceVaultRefs: string[];
  snapshotSchemaVersion: number;
  snapshotHash: string;
  retrievalCount: number;
  lastRetrievedBy: string | null;
  lastRetrievedAt: Date | null;
}

interface EvidenceVaultRefRow {
  ref: string;
  reportId: string;
  gigId: string;
  classification: EvidenceVaultRef['classification'];
  retentionPolicy: EvidenceVaultRef['retentionPolicy'];
  legalHold: boolean;
  allowedRoles: string[];
  createdBy: string;
  createdAt: Date;
  accessCount: number;
  lastAccessedBy: string | null;
  lastAccessedAt: Date | null;
}

@Injectable()
export class PostgresCategoryRepository implements CategoryRepository {
  constructor(private readonly pg: PgService) {}

  async listActive(): Promise<Category[]> {
    await this.ensureDefaults();
    const rows = await this.pg.query<CategoryRow>(
      `SELECT id, "nameMl", "nameEn", "group", active
       FROM "Category"
       WHERE active = true
       ORDER BY "group", "nameEn"`,
    );
    return rows.map(toCategory);
  }

  async findById(id: string): Promise<Category | null> {
    await this.ensureDefaults();
    const [row] = await this.pg.query<CategoryRow>(
      `SELECT id, "nameMl", "nameEn", "group", active
       FROM "Category"
       WHERE id = $1`,
      [id],
    );
    return row ? toCategory(row) : null;
  }

  async save(category: Category): Promise<void> {
    await this.pg.query(
      `INSERT INTO "Category" (id, "nameMl", "nameEn", "group", active)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         "nameMl" = EXCLUDED."nameMl",
         "nameEn" = EXCLUDED."nameEn",
         "group" = EXCLUDED."group",
         active = EXCLUDED.active`,
      [category.id, category.nameMl, category.nameEn, category.group, category.active],
    );
  }

  private async ensureDefaults(): Promise<void> {
    for (const category of DEFAULT_CATEGORIES) {
      await this.save(category);
    }
  }
}

@Injectable()
export class PostgresGigRepository implements GigRepository {
  constructor(private readonly pg: PgService) {}

  async save(gig: Gig): Promise<void> {
    await this.pg.query(
      `INSERT INTO "Gig"
        (id, "giverId", "categoryId", title, description, location,
         "scheduledAt", "budgetAmount", currency, status, "visibilityStatus",
         "riskLevel", "safetyFlags", "moderatedBy", "moderatedAt",
         "moderationReason", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       ON CONFLICT (id) DO UPDATE SET
         "categoryId" = EXCLUDED."categoryId",
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         location = EXCLUDED.location,
         "scheduledAt" = EXCLUDED."scheduledAt",
         "budgetAmount" = EXCLUDED."budgetAmount",
         currency = EXCLUDED.currency,
         status = EXCLUDED.status,
         "visibilityStatus" = EXCLUDED."visibilityStatus",
         "riskLevel" = EXCLUDED."riskLevel",
         "safetyFlags" = EXCLUDED."safetyFlags",
         "moderatedBy" = EXCLUDED."moderatedBy",
         "moderatedAt" = EXCLUDED."moderatedAt",
         "moderationReason" = EXCLUDED."moderationReason"`,
      [
        gig.id,
        gig.giverId,
        gig.categoryId,
        gig.title,
        gig.description,
        gig.location,
        gig.scheduledAt,
        gig.budgetAmount,
        gig.currency,
        gig.status,
        gig.visibilityStatus,
        gig.riskLevel,
        gig.safetyFlags,
        gig.moderatedBy ?? null,
        gig.moderatedAt ?? null,
        gig.moderationReason ?? null,
        gig.createdAt,
      ],
    );
  }

  async findById(id: string): Promise<Gig | null> {
    const [row] = await this.pg.query<GigRow>(`${selectGig()} WHERE id = $1`, [id]);
    return row ? toGig(row) : null;
  }

  async list(filters: GigFilters = {}): Promise<Gig[]> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filters.status) {
      params.push(filters.status);
      clauses.push(`status = $${params.length}`);
    }
    if (filters.categoryId) {
      params.push(filters.categoryId);
      clauses.push(`"categoryId" = $${params.length}`);
    }
    if (filters.visibilityStatus) {
      params.push(filters.visibilityStatus);
      clauses.push(`"visibilityStatus" = $${params.length}`);
    }
    if (filters.giverId) {
      params.push(filters.giverId);
      clauses.push(`"giverId" = $${params.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await this.pg.query<GigRow>(
      `${selectGig()} ${where} ORDER BY "scheduledAt" ASC`,
      params,
    );
    return rows.map(toGig);
  }
}

@Injectable()
export class PostgresApplicationRepository implements ApplicationRepository {
  constructor(private readonly pg: PgService) {}

  async save(application: GigApplication): Promise<void> {
    await this.pg.query(
      `INSERT INTO "Application"
        (id, "gigId", "workerId", "messageMl", "proposedPrice", "priceDeltaAmount", "negotiationTokenCost", status, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT ("gigId", "workerId") DO UPDATE SET
         "messageMl" = EXCLUDED."messageMl",
         "proposedPrice" = EXCLUDED."proposedPrice",
         "priceDeltaAmount" = EXCLUDED."priceDeltaAmount",
         "negotiationTokenCost" = EXCLUDED."negotiationTokenCost",
         status = EXCLUDED.status`,
      [
        application.id,
        application.gigId,
        application.workerId,
        application.messageMl ?? null,
        application.proposedPrice ?? null,
        application.priceDeltaAmount,
        application.negotiationTokenCost,
        application.status,
        application.createdAt,
      ],
    );
  }

  async findById(id: string): Promise<GigApplication | null> {
    const [row] = await this.pg.query<ApplicationRow>(`${selectApplication()} WHERE id = $1`, [
      id,
    ]);
    return row ? toApplication(row) : null;
  }

  async findByGigAndWorker(gigId: string, workerId: string): Promise<GigApplication | null> {
    const [row] = await this.pg.query<ApplicationRow>(
      `${selectApplication()} WHERE "gigId" = $1 AND "workerId" = $2`,
      [gigId, workerId],
    );
    return row ? toApplication(row) : null;
  }

  async listForGig(gigId: string): Promise<GigApplication[]> {
    const rows = await this.pg.query<ApplicationRow>(
      `${selectApplication()} WHERE "gigId" = $1 ORDER BY "createdAt" ASC`,
      [gigId],
    );
    return rows.map(toApplication);
  }

  async listForWorker(workerId: string): Promise<GigApplication[]> {
    const rows = await this.pg.query<ApplicationRow>(
      `${selectApplication()} WHERE "workerId" = $1 ORDER BY "createdAt" DESC`,
      [workerId],
    );
    return rows.map(toApplication);
  }
}

@Injectable()
export class PostgresAssignmentRepository implements AssignmentRepository {
  constructor(private readonly pg: PgService) {}

  async save(assignment: Assignment): Promise<void> {
    await this.pg.query(
      `INSERT INTO "Assignment"
        (id, "gigId", "workerId", "applicationId", "agreedAmount",
         "platformFeeAmount", "workerPayoutAmount", "selectedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT ("gigId") DO UPDATE SET
         "workerId" = EXCLUDED."workerId",
         "applicationId" = EXCLUDED."applicationId",
         "agreedAmount" = EXCLUDED."agreedAmount",
         "platformFeeAmount" = EXCLUDED."platformFeeAmount",
         "workerPayoutAmount" = EXCLUDED."workerPayoutAmount",
         "selectedAt" = EXCLUDED."selectedAt"`,
      [
        assignment.id,
        assignment.gigId,
        assignment.workerId,
        assignment.applicationId,
        assignment.agreedAmount,
        assignment.platformFeeAmount,
        assignment.workerPayoutAmount,
        assignment.selectedAt,
      ],
    );
  }

  async findByGig(gigId: string): Promise<Assignment | null> {
    const [row] = await this.pg.query<AssignmentRow>(
      `SELECT id, "gigId", "workerId", "applicationId", "agreedAmount",
              "platformFeeAmount", "workerPayoutAmount", "selectedAt"
       FROM "Assignment"
       WHERE "gigId" = $1`,
      [gigId],
    );
    return row ? toAssignment(row) : null;
  }
}

@Injectable()
export class PostgresRatingRepository implements RatingRepository {
  constructor(private readonly pg: PgService) {}

  async save(rating: Rating): Promise<void> {
    await this.pg.query(
      `INSERT INTO "Rating"
        (id, "gigId", "raterId", "rateeId", direction, stars, tags, comment, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
       ON CONFLICT ("gigId", direction) DO UPDATE SET
         stars = EXCLUDED.stars,
         tags = EXCLUDED.tags,
         comment = EXCLUDED.comment`,
      [
        rating.id,
        rating.gigId,
        rating.raterId,
        rating.rateeId,
        rating.direction,
        rating.stars,
        JSON.stringify(rating.tags),
        rating.comment ?? null,
        rating.createdAt,
      ],
    );
  }

  async findByGigAndDirection(
    gigId: string,
    direction: RatingDirection,
  ): Promise<Rating | null> {
    const [row] = await this.pg.query<RatingRow>(
      `${selectRating()} WHERE "gigId" = $1 AND direction = $2`,
      [gigId, direction],
    );
    return row ? toRating(row) : null;
  }

  async listForGig(gigId: string): Promise<Rating[]> {
    const rows = await this.pg.query<RatingRow>(
      `${selectRating()} WHERE "gigId" = $1 ORDER BY "createdAt" ASC`,
      [gigId],
    );
    return rows.map(toRating);
  }

  async listForRatee(rateeId: string, direction: RatingDirection): Promise<Rating[]> {
    const rows = await this.pg.query<RatingRow>(
      `${selectRating()} WHERE "rateeId" = $1 AND direction = $2 ORDER BY "createdAt" ASC`,
      [rateeId, direction],
    );
    return rows.map(toRating);
  }

  async listAtOrBelowStars(maxStars: number): Promise<Rating[]> {
    const rows = await this.pg.query<RatingRow>(
      `${selectRating()} WHERE stars <= $1 ORDER BY "createdAt" ASC`,
      [maxStars],
    );
    return rows.map(toRating);
  }
}

@Injectable()
export class PostgresSafetyReportRepository implements SafetyReportRepository {
  constructor(private readonly pg: PgService) {}

  async save(report: SafetyReport): Promise<void> {
    await this.pg.query(
      `INSERT INTO "SafetyReport"
        (id, "gigId", "reporterId", "reportedUserId", reason, severity, description,
         "evidenceVaultRefs", status, "actionTaken", "reviewedBy", "reviewedAt",
         "lawEnforcementRef", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         "actionTaken" = EXCLUDED."actionTaken",
         "reviewedBy" = EXCLUDED."reviewedBy",
         "reviewedAt" = EXCLUDED."reviewedAt",
         "lawEnforcementRef" = EXCLUDED."lawEnforcementRef"`,
      [
        report.id,
        report.gigId,
        report.reporterId,
        report.reportedUserId ?? null,
        report.reason,
        report.severity,
        report.description,
        report.evidenceVaultRefs,
        report.status,
        report.actionTaken ?? null,
        report.reviewedBy ?? null,
        report.reviewedAt ?? null,
        report.lawEnforcementRef ?? null,
        report.createdAt,
      ],
    );
  }

  async findById(id: string): Promise<SafetyReport | null> {
    const [row] = await this.pg.query<SafetyReportRow>(`${selectSafetyReport()} WHERE id = $1`, [
      id,
    ]);
    return row ? toSafetyReport(row) : null;
  }

  async list(filters: { status?: string; gigId?: string } = {}): Promise<SafetyReport[]> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filters.status) {
      params.push(filters.status);
      clauses.push(`status = $${params.length}`);
    }
    if (filters.gigId) {
      params.push(filters.gigId);
      clauses.push(`"gigId" = $${params.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await this.pg.query<SafetyReportRow>(
      `${selectSafetyReport()} ${where} ORDER BY "createdAt" ASC`,
      params,
    );
    return rows.map(toSafetyReport);
  }
}

@Injectable()
export class PostgresEvidenceVaultRefRepository implements EvidenceVaultRefRepository {
  constructor(private readonly pg: PgService) {}

  async save(ref: EvidenceVaultRef): Promise<void> {
    await this.pg.query(
      `INSERT INTO "EvidenceVaultRef"
        (ref, "reportId", "gigId", classification, "retentionPolicy", "legalHold",
         "allowedRoles", "createdBy", "createdAt", "accessCount", "lastAccessedBy", "lastAccessedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (ref) DO UPDATE SET
         classification = EXCLUDED.classification,
         "retentionPolicy" = EXCLUDED."retentionPolicy",
         "legalHold" = EXCLUDED."legalHold",
         "allowedRoles" = EXCLUDED."allowedRoles"`,
      [
        ref.ref,
        ref.reportId,
        ref.gigId,
        ref.classification,
        ref.retentionPolicy,
        ref.legalHold,
        ref.allowedRoles,
        ref.createdBy,
        ref.createdAt,
        ref.accessCount,
        ref.lastAccessedBy ?? null,
        ref.lastAccessedAt ?? null,
      ],
    );
  }

  async findByRef(ref: string): Promise<EvidenceVaultRef | null> {
    const [row] = await this.pg.query<EvidenceVaultRefRow>(
      `${selectEvidenceVaultRef()} WHERE ref = $1`,
      [ref],
    );
    return row ? toEvidenceVaultRef(row) : null;
  }

  async listForReport(reportId: string): Promise<EvidenceVaultRef[]> {
    const rows = await this.pg.query<EvidenceVaultRefRow>(
      `${selectEvidenceVaultRef()} WHERE "reportId" = $1 ORDER BY "createdAt" ASC`,
      [reportId],
    );
    return rows.map(toEvidenceVaultRef);
  }

  async markAccessed(ref: string, actorId: string, at: string): Promise<EvidenceVaultRef | null> {
    const [row] = await this.pg.query<EvidenceVaultRefRow>(
      `UPDATE "EvidenceVaultRef"
       SET "accessCount" = "accessCount" + 1,
           "lastAccessedBy" = $2,
           "lastAccessedAt" = $3
       WHERE ref = $1
       RETURNING ref, "reportId", "gigId", classification, "retentionPolicy", "legalHold",
                 "allowedRoles", "createdBy", "createdAt", "accessCount",
                 "lastAccessedBy", "lastAccessedAt"`,
      [ref, actorId, at],
    );
    return row ? toEvidenceVaultRef(row) : null;
  }
}

@Injectable()
export class PostgresEscalationPackageRepository implements EscalationPackageRepository {
  constructor(private readonly pg: PgService) {}

  async save(manifest: EscalationPackageManifest): Promise<void> {
    await this.pg.query(
      `INSERT INTO "EscalationPackageManifest"
        (id, "reportId", "gigId", "generatedBy", "generatedAt", "evidenceVaultRefs",
         "snapshotSchemaVersion", "snapshotHash", "retrievalCount", "lastRetrievedBy", "lastRetrievedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET
         "evidenceVaultRefs" = EXCLUDED."evidenceVaultRefs",
         "snapshotSchemaVersion" = EXCLUDED."snapshotSchemaVersion",
         "snapshotHash" = EXCLUDED."snapshotHash",
         "retrievalCount" = EXCLUDED."retrievalCount",
         "lastRetrievedBy" = EXCLUDED."lastRetrievedBy",
         "lastRetrievedAt" = EXCLUDED."lastRetrievedAt"`,
      [
        manifest.id,
        manifest.reportId,
        manifest.gigId,
        manifest.generatedBy,
        manifest.generatedAt,
        manifest.evidenceVaultRefs,
        manifest.snapshotSchemaVersion,
        manifest.snapshotHash,
        manifest.retrievalCount,
        manifest.lastRetrievedBy ?? null,
        manifest.lastRetrievedAt ?? null,
      ],
    );
  }

  async findById(id: string): Promise<EscalationPackageManifest | null> {
    const [row] = await this.pg.query<EscalationPackageManifestRow>(
      `${selectEscalationPackageManifest()} WHERE id = $1`,
      [id],
    );
    return row ? toEscalationPackageManifest(row) : null;
  }

  async markRetrieved(
    id: string,
    actorId: string,
    at: string,
  ): Promise<EscalationPackageManifest | null> {
    const [row] = await this.pg.query<EscalationPackageManifestRow>(
      `UPDATE "EscalationPackageManifest"
       SET "retrievalCount" = "retrievalCount" + 1,
           "lastRetrievedBy" = $2,
           "lastRetrievedAt" = $3
       WHERE id = $1
       RETURNING id, "reportId", "gigId", "generatedBy", "generatedAt", "evidenceVaultRefs",
                 "snapshotSchemaVersion", "snapshotHash", "retrievalCount",
                 "lastRetrievedBy", "lastRetrievedAt"`,
      [id, actorId, at],
    );
    return row ? toEscalationPackageManifest(row) : null;
  }
}

function selectGig(): string {
  return `SELECT id, "giverId", "categoryId", title, description, location,
                 "scheduledAt", "budgetAmount", currency, status, "visibilityStatus",
                 "riskLevel", "safetyFlags", "moderatedBy", "moderatedAt",
                 "moderationReason", "createdAt"
          FROM "Gig"`;
}

function selectApplication(): string {
  return `SELECT id, "gigId", "workerId", "messageMl", "proposedPrice", "priceDeltaAmount", "negotiationTokenCost", status, "createdAt"
          FROM "Application"`;
}

function selectRating(): string {
  return `SELECT id, "gigId", "raterId", "rateeId", direction, stars, tags, comment, "createdAt"
          FROM "Rating"`;
}

function toCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    nameMl: row.nameMl,
    nameEn: row.nameEn,
    group: row.group,
    active: row.active,
  };
}

function toGig(row: GigRow): Gig {
  return {
    id: row.id,
    giverId: row.giverId,
    categoryId: row.categoryId,
    title: row.title,
    description: row.description,
    location: row.location,
    scheduledAt: row.scheduledAt.toISOString(),
    budgetAmount: row.budgetAmount,
    currency: row.currency,
    status: row.status,
    visibilityStatus: row.visibilityStatus,
    riskLevel: row.riskLevel,
    safetyFlags: row.safetyFlags ?? [],
    moderatedBy: row.moderatedBy ?? undefined,
    moderatedAt: row.moderatedAt?.toISOString(),
    moderationReason: row.moderationReason ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

function toApplication(row: ApplicationRow): GigApplication {
  return {
    id: row.id,
    gigId: row.gigId,
    workerId: row.workerId,
    messageMl: row.messageMl ?? undefined,
    proposedPrice: row.proposedPrice ?? undefined,
    priceDeltaAmount: row.priceDeltaAmount ?? 0,
    negotiationTokenCost: row.negotiationTokenCost ?? 0,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

function toAssignment(row: AssignmentRow): Assignment {
  return {
    id: row.id,
    gigId: row.gigId,
    workerId: row.workerId,
    applicationId: row.applicationId,
    agreedAmount: row.agreedAmount,
    platformFeeAmount: row.platformFeeAmount,
    workerPayoutAmount: row.workerPayoutAmount,
    selectedAt: row.selectedAt.toISOString(),
  };
}

function toRating(row: RatingRow): Rating {
  return {
    id: row.id,
    gigId: row.gigId,
    raterId: row.raterId,
    rateeId: row.rateeId,
    direction: row.direction,
    stars: row.stars,
    tags: row.tags ?? [],
    comment: row.comment ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

function selectSafetyReport(): string {
  return `SELECT id, "gigId", "reporterId", "reportedUserId", reason, severity,
                 description, "evidenceVaultRefs", status, "actionTaken", "reviewedBy",
                 "reviewedAt", "lawEnforcementRef", "createdAt"
          FROM "SafetyReport"`;
}

function selectEscalationPackageManifest(): string {
  return `SELECT id, "reportId", "gigId", "generatedBy", "generatedAt", "evidenceVaultRefs",
                 "snapshotSchemaVersion", "snapshotHash", "retrievalCount",
                 "lastRetrievedBy", "lastRetrievedAt"
          FROM "EscalationPackageManifest"`;
}

function selectEvidenceVaultRef(): string {
  return `SELECT ref, "reportId", "gigId", classification, "retentionPolicy", "legalHold",
                 "allowedRoles", "createdBy", "createdAt", "accessCount",
                 "lastAccessedBy", "lastAccessedAt"
          FROM "EvidenceVaultRef"`;
}

function toSafetyReport(row: SafetyReportRow): SafetyReport {
  return {
    id: row.id,
    gigId: row.gigId,
    reporterId: row.reporterId,
    reportedUserId: row.reportedUserId ?? undefined,
    reason: row.reason,
    severity: row.severity,
    description: row.description,
    evidenceVaultRefs: row.evidenceVaultRefs ?? [],
    status: row.status,
    actionTaken: row.actionTaken ?? undefined,
    reviewedBy: row.reviewedBy ?? undefined,
    reviewedAt: row.reviewedAt?.toISOString(),
    lawEnforcementRef: row.lawEnforcementRef ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

function toEscalationPackageManifest(
  row: EscalationPackageManifestRow,
): EscalationPackageManifest {
  return {
    id: row.id,
    reportId: row.reportId,
    gigId: row.gigId,
    generatedBy: row.generatedBy,
    generatedAt: row.generatedAt.toISOString(),
    evidenceVaultRefs: row.evidenceVaultRefs ?? [],
    snapshotSchemaVersion: row.snapshotSchemaVersion,
    snapshotHash: row.snapshotHash,
    retrievalCount: row.retrievalCount,
    lastRetrievedBy: row.lastRetrievedBy ?? undefined,
    lastRetrievedAt: row.lastRetrievedAt?.toISOString(),
  };
}

function toEvidenceVaultRef(row: EvidenceVaultRefRow): EvidenceVaultRef {
  return {
    ref: row.ref,
    reportId: row.reportId,
    gigId: row.gigId,
    classification: row.classification,
    retentionPolicy: row.retentionPolicy,
    legalHold: row.legalHold,
    allowedRoles: row.allowedRoles ?? [],
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    accessCount: row.accessCount,
    lastAccessedBy: row.lastAccessedBy ?? undefined,
    lastAccessedAt: row.lastAccessedAt?.toISOString(),
  };
}
