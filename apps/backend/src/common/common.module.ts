import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from './audit/audit.service';
import { InMemoryPiiVault, PII_VAULT } from './pii/pii-vault';

/**
 * Global infrastructure shared across modules: the audit log and the PII vault.
 * Phase 1 uses the in-memory AES-GCM vault; production binds an isolated,
 * KMS-backed implementation to the same PII_VAULT token.
 */
@Global()
@Module({
  providers: [
    AuditService,
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
