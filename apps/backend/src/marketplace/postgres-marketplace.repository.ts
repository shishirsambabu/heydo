import { Injectable } from '@nestjs/common';
import { PgService } from '../common/database/pg.service';
import {
  Assignment,
  Category,
  DEFAULT_CATEGORIES,
  Gig,
  GigApplication,
  SafetyReport,
} from './marketplace.entities';
import {
  ApplicationRepository,
  AssignmentRepository,
  CategoryRepository,
  GigFilters,
  GigRepository,
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
  status: GigApplication['status'];
  createdAt: Date;
}

interface AssignmentRow {
  id: string;
  gigId: string;
  workerId: string;
  applicationId: string;
  selectedAt: Date;
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
        (id, "gigId", "workerId", "messageMl", "proposedPrice", status, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT ("gigId", "workerId") DO UPDATE SET
         "messageMl" = EXCLUDED."messageMl",
         "proposedPrice" = EXCLUDED."proposedPrice",
         status = EXCLUDED.status`,
      [
        application.id,
        application.gigId,
        application.workerId,
        application.messageMl ?? null,
        application.proposedPrice ?? null,
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
}

@Injectable()
export class PostgresAssignmentRepository implements AssignmentRepository {
  constructor(private readonly pg: PgService) {}

  async save(assignment: Assignment): Promise<void> {
    await this.pg.query(
      `INSERT INTO "Assignment" (id, "gigId", "workerId", "applicationId", "selectedAt")
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ("gigId") DO UPDATE SET
         "workerId" = EXCLUDED."workerId",
         "applicationId" = EXCLUDED."applicationId",
         "selectedAt" = EXCLUDED."selectedAt"`,
      [
        assignment.id,
        assignment.gigId,
        assignment.workerId,
        assignment.applicationId,
        assignment.selectedAt,
      ],
    );
  }

  async findByGig(gigId: string): Promise<Assignment | null> {
    const [row] = await this.pg.query<AssignmentRow>(
      `SELECT id, "gigId", "workerId", "applicationId", "selectedAt"
       FROM "Assignment"
       WHERE "gigId" = $1`,
      [gigId],
    );
    return row ? toAssignment(row) : null;
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

function selectGig(): string {
  return `SELECT id, "giverId", "categoryId", title, description, location,
                 "scheduledAt", "budgetAmount", currency, status, "visibilityStatus",
                 "riskLevel", "safetyFlags", "moderatedBy", "moderatedAt",
                 "moderationReason", "createdAt"
          FROM "Gig"`;
}

function selectApplication(): string {
  return `SELECT id, "gigId", "workerId", "messageMl", "proposedPrice", status, "createdAt"
          FROM "Application"`;
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
    selectedAt: row.selectedAt.toISOString(),
  };
}

function selectSafetyReport(): string {
  return `SELECT id, "gigId", "reporterId", "reportedUserId", reason, severity,
                 description, "evidenceVaultRefs", status, "actionTaken", "reviewedBy",
                 "reviewedAt", "lawEnforcementRef", "createdAt"
          FROM "SafetyReport"`;
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
