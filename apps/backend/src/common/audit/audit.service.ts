import { randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { redactForLog } from '../pii/redaction';
import { AuditRepository, InMemoryAuditRepository } from './audit.repository';

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
  constructor(private readonly repo: AuditRepository = new InMemoryAuditRepository()) {}

  record(entry: Omit<AuditRecord, 'id' | 'at'>): void {
    const safe: AuditRecord = {
      id: `audit_${Date.now()}_${randomBytes(6).toString('hex')}`,
      at: new Date().toISOString(),
      ...entry,
      metadata: entry.metadata
        ? (redactForLog(entry.metadata) as Record<string, unknown>)
        : undefined,
    };
    void Promise.resolve(this.repo.append(safe)).catch(() => {
      // Production should route this to process-level error telemetry.
    });
  }

  /** Read-only view (Super Admin / tests). Never mutated externally. */
  entries(): readonly AuditRecord[] {
    return this.repo instanceof InMemoryAuditRepository ? this.repo.entries() : [];
  }

  list(filters: AuditFilters = {}): Promise<AuditRecord[]> {
    return this.repo.list(filters);
  }
}
