import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuditService } from './audit/audit.service';
import {
  AUDIT_REPOSITORY,
  AuditRepository,
  InMemoryAuditRepository,
  PostgresAuditRepository,
} from './audit/audit.repository';
import { InMemoryPiiVault, PII_VAULT } from './pii/pii-vault';

/**
 * Global infrastructure shared across modules: the audit log and the PII vault.
 * Phase 1 uses the in-memory AES-GCM vault; production binds an isolated,
 * KMS-backed implementation to the same PII_VAULT token.
 */
@Global()
@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: AUDIT_REPOSITORY,
      inject: [ConfigService, PostgresAuditRepository],
      useFactory: (config: ConfigService, postgres: PostgresAuditRepository): AuditRepository =>
        config.get<string>('PERSISTENCE') === 'postgres'
          ? postgres
          : new InMemoryAuditRepository(),
    },
    PostgresAuditRepository,
    {
      provide: AuditService,
      inject: [AUDIT_REPOSITORY],
      useFactory: (repo: AuditRepository) => new AuditService(repo),
    },
    {
      provide: PII_VAULT,
      useFactory: (config: ConfigService) =>
        new InMemoryPiiVault(config.get<string>('PII_ENCRYPTION_KEY') ?? 'dev-only-key'),
      inject: [ConfigService],
    },
  ],
  exports: [AuditService, PII_VAULT],
})
export class CommonModule {}
