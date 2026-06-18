import { Injectable } from '@nestjs/common';
import { PgService } from '../database/pg.service';
import type { AuditFilters, AuditRecord } from './audit.service';

export interface AuditRepository {
  append(record: AuditRecord): void | Promise<void>;
  list(filters?: AuditFilters): Promise<AuditRecord[]>;
}

export const AUDIT_REPOSITORY = Symbol('AUDIT_REPOSITORY');

export class InMemoryAuditRepository implements AuditRepository {
  private readonly log: AuditRecord[] = [];

  append(record: AuditRecord): void {
    this.log.push(copyRecord(record));
  }

  async list(filters: AuditFilters = {}): Promise<AuditRecord[]> {
    return this.log
      .filter((entry) => !filters.targetType || entry.targetType === filters.targetType)
      .filter((entry) => !filters.targetId || entry.targetId === filters.targetId)
      .filter((entry) => !filters.actorId || entry.actorId === filters.actorId)
      .filter((entry) => !filters.actionPrefix || entry.action.startsWith(filters.actionPrefix))
      .filter((entry) => metadataMatches(entry.metadata, filters.metadata))
      .map(copyRecord);
  }

  entries(): readonly AuditRecord[] {
    return this.log;
  }
}

interface AuditLogRow {
  id: string;
  actorId: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown> | null;
  at: Date;
}

@Injectable()
export class PostgresAuditRepository implements AuditRepository {
  constructor(private readonly pg: PgService) {}

  async append(record: AuditRecord): Promise<void> {
    await this.pg.query(
      `INSERT INTO "AuditLog"
        (id, "actorId", "actorRole", action, "targetType", "targetId", metadata, at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
       ON CONFLICT (id) DO NOTHING`,
      [
        record.id,
        record.actorId,
        record.actorRole,
        record.action,
        record.targetType,
        record.targetId,
        record.metadata ? JSON.stringify(record.metadata) : null,
        record.at,
      ],
    );
  }

  async list(filters: AuditFilters = {}): Promise<AuditRecord[]> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filters.targetType) {
      params.push(filters.targetType);
      clauses.push(`"targetType" = $${params.length}`);
    }
    if (filters.targetId) {
      params.push(filters.targetId);
      clauses.push(`"targetId" = $${params.length}`);
    }
    if (filters.actorId) {
      params.push(filters.actorId);
      clauses.push(`"actorId" = $${params.length}`);
    }
    if (filters.actionPrefix) {
      params.push(`${filters.actionPrefix}%`);
      clauses.push(`action LIKE $${params.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await this.pg.query<AuditLogRow>(
      `SELECT id, "actorId", "actorRole", action, "targetType", "targetId", metadata, at
       FROM "AuditLog"
       ${where}
       ORDER BY at ASC, id ASC`,
      params,
    );
    return rows.map(toRecord).filter((entry) => metadataMatches(entry.metadata, filters.metadata));
  }
}

export function metadataMatches(
  metadata: Record<string, unknown> | undefined,
  filters: Record<string, string> | undefined,
): boolean {
  if (!filters) return true;
  if (!metadata) return false;
  return Object.entries(filters).every(([key, value]) => metadata[key] === value);
}

function toRecord(row: AuditLogRow): AuditRecord {
  return {
    id: row.id,
    actorId: row.actorId,
    actorRole: row.actorRole,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    metadata: row.metadata ?? undefined,
    at: row.at.toISOString(),
  };
}

function copyRecord(record: AuditRecord): AuditRecord {
  return {
    ...record,
    metadata: record.metadata ? { ...record.metadata } : undefined,
  };
}
