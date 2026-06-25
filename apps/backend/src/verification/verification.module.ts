import { Module } from '@nestjs/common';
import { VerificationService } from './verification.service';
import { VerificationController } from './verification.controller';
import { AdminVerificationController } from './admin-verification.controller';
import { DiditWebhookController } from './didit-webhook.controller';
import {
  CONSENT_REPOSITORY,
  ConsentRepository,
  InMemoryConsentRepository,
  InMemoryVerificationRepository,
  VERIFICATION_REPOSITORY,
  VerificationRepository,
} from './verification.repository';
import { ConfigService } from '@nestjs/config';
import { DiditVkycProvider } from './vkyc/didit-vkyc-provider';
import { MockVkycProvider } from './vkyc/mock-vkyc-provider';
import { VKYC_PROVIDER, VkycProvider } from './vkyc/vkyc-provider';
import {
  PostgresConsentRepository,
  PostgresVerificationRepository,
} from './postgres-verification.repository';
import { DatabaseModule } from '../common/database/database.module';
import { PII_VAULT, PiiVault } from '../common/pii/pii-vault';
import { AuditService } from '../common/audit/audit.service';
import { SecurityModule } from '../auth/security.module';
import { IdentityModule } from '../identity/identity.module';
import { IdentityVerificationStatusSink, UserRepository } from '../identity/identity.repository';

/**
 * Verification (VKYC) module. Phase 1 binds in-memory repositories and the mock
 * VKYC provider; production swaps the persistence + the licensed vendor behind
 * the same tokens. The WorkerProfileRepository is injected as the
 * WorkerVerificationSink so a worker's status stays in sync.
 */
@Module({
  imports: [SecurityModule, IdentityModule, DatabaseModule],
  controllers: [VerificationController, AdminVerificationController, DiditWebhookController],
  providers: [
    {
      provide: VERIFICATION_REPOSITORY,
      inject: [ConfigService, PostgresVerificationRepository],
      useFactory: (config: ConfigService, postgres: PostgresVerificationRepository) =>
        config.get<string>('PERSISTENCE') === 'postgres'
          ? postgres
          : new InMemoryVerificationRepository(),
    },
    {
      provide: CONSENT_REPOSITORY,
      inject: [ConfigService, PostgresConsentRepository],
      useFactory: (config: ConfigService, postgres: PostgresConsentRepository) =>
        config.get<string>('PERSISTENCE') === 'postgres'
          ? postgres
          : new InMemoryConsentRepository(),
    },
    PostgresVerificationRepository,
    PostgresConsentRepository,
    {
      provide: VKYC_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): VkycProvider => {
        const provider = config.get<string>('VKYC_PROVIDER') ?? 'mock';
        if (provider === 'didit') {
          return new DiditVkycProvider({
            apiKey: config.get<string>('DIDIT_API_KEY') ?? '',
            workflowId: config.get<string>('DIDIT_WORKFLOW_ID') ?? '',
            giverWorkflowId: config.get<string>('DIDIT_GIVER_WORKFLOW_ID'),
            baseUrl: config.get<string>('DIDIT_BASE_URL'),
            callbackUrl: config.get<string>('DIDIT_CALLBACK_URL'),
            languageFallback: config.get<string>('DIDIT_LANGUAGE_FALLBACK') ?? 'en',
          });
        }
        return new MockVkycProvider();
      },
    },
    {
      provide: VerificationService,
      inject: [
        VERIFICATION_REPOSITORY,
        CONSENT_REPOSITORY,
        VKYC_PROVIDER,
        PII_VAULT,
        AuditService,
        IdentityVerificationStatusSink,
        UserRepository,
      ],
      useFactory: (
        verifications: VerificationRepository,
        consents: ConsentRepository,
        vkyc: VkycProvider,
        vault: PiiVault,
        audit: AuditService,
        sink: IdentityVerificationStatusSink,
        users: UserRepository,
      ) => new VerificationService(verifications, consents, vkyc, vault, audit, sink, users),
    },
  ],
  exports: [VerificationService],
})
export class VerificationModule {}
