import { Injectable } from '@nestjs/common';
import { redactForLog } from '../pii/redaction';

/**
 * Append-only audit log. Every sensitive action (PII access, verification
 * decision, money movement, role change, deactivation) writes a record here.
 *
 * Records contain NO raw PII — references/masked values only (redactForLog).
 * Production: append-only, tamper-evident store. Dev: in-memory array.
 *
 * See docs/phase-0/05-rbac-and-audit.md and .claude/rules/pii_and_privacy.md
 */
export interface AuditRecord {
  id: string;
  actorId: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
  at: string; // ISO timestamp
}

export interface AuditFilters {
  targetType?: string;
  targetId?: string;
  actorId?: string;
  actionPrefix?: string;
  metadata?: Record<string, string>;
}

@Injectable()
export class AuditService {
  private readonly log: AuditRecord[] = [];

  record(entry: Omit<AuditRecord, 'id' | 'at'>): void {
    const safe: AuditRecord = {
      id: `audit_${Date.now()}_${this.log.length}`,
      at: new Date().toISOString(),
      ...entry,
      metadata: entry.metadata
        ? (redactForLog(entry.metadata) as Record<string, unknown>)
        : undefined,
    };
    this.log.push(safe);
  }

  /** Read-only view (Super Admin / tests). Never mutated externally. */
  entries(): readonly AuditRecord[] {
    return this.log;
  }

  list(filters: AuditFilters = {}): AuditRecord[] {
    return this.log
      .filter((entry) => !filters.targetType || entry.targetType === filters.targetType)
      .filter((entry) => !filters.targetId || entry.targetId === filters.targetId)
      .filter((entry) => !filters.actorId || entry.actorId === filters.actorId)
      .filter((entry) => !filters.actionPrefix || entry.action.startsWith(filters.actionPrefix))
      .filter((entry) => metadataMatches(entry.metadata, filters.metadata))
      .map((entry) => ({
        ...entry,
        metadata: entry.metadata ? { ...entry.metadata } : undefined,
      }));
  }
}

function metadataMatches(
  metadata: Record<string, unknown> | undefined,
  filters: Record<string, string> | undefined,
): boolean {
  if (!filters) return true;
  if (!metadata) return false;
  return Object.entries(filters).every(([key, value]) => metadata[key] === value);
}
