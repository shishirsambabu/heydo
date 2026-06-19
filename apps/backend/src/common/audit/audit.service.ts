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

export interface AuditWriteFailure {
  recordId: string;
  action: string;
  targetType: string;
  targetId: string;
  error: string;
  at: string;
}

export interface AuditHealth {
  status: 'ok' | 'degraded';
  failedWriteCount: number;
  recentFailures: AuditWriteFailure[];
}

@Injectable()
export class AuditService {
  private readonly failures: AuditWriteFailure[] = [];

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
    void Promise.resolve(this.repo.append(safe)).catch((error: unknown) => {
      this.failures.push({
        recordId: safe.id,
        action: safe.action,
        targetType: safe.targetType,
        targetId: safe.targetId,
        error: errorMessage(error),
        at: new Date().toISOString(),
      });
    });
  }

  /** Read-only view (Super Admin / tests). Never mutated externally. */
  entries(): readonly AuditRecord[] {
    return this.repo instanceof InMemoryAuditRepository ? this.repo.entries() : [];
  }

  list(filters: AuditFilters = {}): Promise<AuditRecord[]> {
    return this.repo.list(filters);
  }

  health(): AuditHealth {
    return {
      status: this.failures.length ? 'degraded' : 'ok',
      failedWriteCount: this.failures.length,
      recentFailures: this.failures.slice(-10).map((failure) => ({ ...failure })),
    };
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
